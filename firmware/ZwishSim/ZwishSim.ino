/*
 * Zwish ride simulator. Flash this instead of Zwish.ino when you want the
 * server to see a moving wheel without pedaling.
 *
 * Board, libraries, and upload settings match Zwish.ino:
 *   ESP32 by Espressif, board "ESP32 Dev Module", upload 115200.
 *   ArduinoJson by Benoit Blanchon, WebSockets by Markus Sattler.
 * Leave "Erase Flash" off so the device id and WiFi settings survive.
 *
 * The sketch reads the same stored settings as the real sensor (device id,
 * WiFi, API host). It connects with TLS to port 443 and accepts the nginx
 * certificate. Samples use the same JSON. Each message is one
 * wheel revolution: seq, monoUs, revCount, dtUs. Heart rate is the optional
 * hrBpm field the server already accepts; set kSimulateHeartRate to false to
 * omit it.
 *
 * Wheel speed steps between an easy and a hard block so power, cadence, and
 * zones move. Flash Zwish.ino again to return to the hall sensor.
 */

#include <Arduino.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WebSocketsClient.h>
#include <WiFi.h>
#include <math.h>

constexpr int kLedPin = 2;
constexpr int kQueueLength = 48;
constexpr unsigned long kLedPulseMs = 40;

// Wheel revolutions per minute. The server turns this into cadence and power
// from the bike gears and the trainer curve. 190 is an easy spin, 310 is hard.
constexpr double kEasyRpm = 190;
constexpr double kHardRpm = 310;
constexpr uint32_t kEasyMs = 45000;
constexpr uint32_t kHardMs = 20000;
constexpr double kWobbleRpm = 6;
constexpr bool kSimulateHeartRate = true;
constexpr double kHrEasy = 128;
constexpr double kHrHard = 162;

struct Sample {
  uint32_t seq;
  uint64_t monoUs;
  double revCount;
  uint64_t dtUs;
  int hrBpm;
  bool hasHr;
};

Preferences preferences;
WebServer portal(80);
WebSocketsClient socketClient;

String deviceId;
String wifiSsid;
String wifiPassword;
String serverHost;

Sample queueItems[kQueueLength];
int queueHead = 0;
int queueTail = 0;
uint32_t nextSeq = 1;
uint32_t ackedSeq = 0;
double revCount = 0;
uint64_t lastEdgeUs = 0;
uint32_t lastSentSeq = 0;
unsigned long lastSentMs = 0;
unsigned long ledOffAtMs = 0;
unsigned long lastStatusMs = 0;
bool socketStarted = false;
bool wasHard = false;
double currentHr = kHrEasy;

String newDeviceId() {
  uint8_t bytes[16];
  esp_fill_random(bytes, sizeof(bytes));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  char buffer[37];
  snprintf(buffer, sizeof(buffer),
           "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
           bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
           bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15]);
  return String(buffer);
}

void loadSettings() {
  preferences.begin("zwish", false);
  deviceId = preferences.getString("deviceId", "");
  if (deviceId.length() == 0) {
    deviceId = newDeviceId();
    preferences.putString("deviceId", deviceId);
  }
  wifiSsid = preferences.getString("ssid", "");
  wifiPassword = preferences.getString("password", "");
  serverHost = preferences.getString("host", "");
  preferences.end();
}

void handlePortalRoot() {
  const String page = String("<!doctype html><html><body><h1>Zwish sim ") + deviceId +
                      "</h1><p>This board reuses the real sensor's device id. Copy it into the "
                      "trainer screen if it is not registered yet.</p>"
                      "<p>The host is the computer running Zwish. This board always connects "
                      "to https on port 443, through nginx. For this machine use 192.168.178.48.</p>"
                      "<form method='POST' action='/save'>"
                      "WiFi name <input name='ssid'><br>"
                      "WiFi password <input name='password' type='password'><br>"
                      "API host <input name='host' value='192.168.178.48'><br>"
                      "<button>Save and reboot</button></form></body></html>";
  portal.send(200, "text/html", page);
}

String urlDecode(const String& encoded) {
  String decoded;
  decoded.reserve(encoded.length());
  for (int i = 0; i < encoded.length(); i++) {
    const char c = encoded[i];
    if (c == '+') {
      decoded += ' ';
    } else if (c == '%' && i + 2 < encoded.length()) {
      char hex[3] = {encoded[i + 1], encoded[i + 2], 0};
      decoded += static_cast<char>(strtol(hex, nullptr, 16));
      i += 2;
    } else {
      decoded += c;
    }
  }
  return decoded;
}

String formField(const char* key) {
  if (portal.hasArg(key) && portal.arg(key).length() > 0) {
    return portal.arg(key);
  }
  const String body = portal.arg("plain");
  const String needle = String(key) + "=";
  const int start = body.indexOf(needle);
  if (start < 0) {
    return "";
  }
  const int valueStart = start + needle.length();
  int end = body.indexOf('&', valueStart);
  if (end < 0) {
    end = body.length();
  }
  return urlDecode(body.substring(valueStart, end));
}

void handlePortalSave() {
  const String ssid = formField("ssid");
  const String password = formField("password");
  const String host = formField("host");
  if (ssid.length() == 0 || host.length() == 0) {
    portal.send(400, "text/html", "<p>WiFi name and API host are required.</p><p><a href='/'>Back</a></p>");
    return;
  }
  portal.send(200, "text/html", "<p>Saved. Rebooting.</p>");
  portal.client().flush();
  delay(200);
  portal.stop();
  WiFi.softAPdisconnect(true);
  WiFi.mode(WIFI_OFF);
  delay(200);
  if (!preferences.begin("zwish", false)) {
    Serial.println("could not open settings storage");
    return;
  }
  preferences.putString("ssid", ssid);
  preferences.putString("password", password);
  preferences.putString("host", host);
  preferences.end();
  Serial.flush();
  delay(100);
  ESP.restart();
}

void startPortal() {
  const String ap = "Zwish-" + deviceId.substring(deviceId.length() - 4);
  WiFi.softAP(ap.c_str());
  portal.on("/", HTTP_GET, handlePortalRoot);
  portal.on("/save", HTTP_POST, handlePortalSave);
  portal.begin();
  pinMode(kLedPin, OUTPUT);
  Serial.printf("Setup portal %s at %s device %s\n", ap.c_str(), WiFi.softAPIP().toString().c_str(),
                deviceId.c_str());
}

bool enqueue(const Sample& sample) {
  const int next = (queueHead + 1) % kQueueLength;
  if (next == queueTail) {
    return false;
  }
  queueItems[queueHead] = sample;
  queueHead = next;
  return true;
}

void dropAcked(uint32_t seq) {
  ackedSeq = seq;
  while (queueTail != queueHead && queueItems[queueTail].seq <= ackedSeq) {
    queueTail = (queueTail + 1) % kQueueLength;
  }
}

void onSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  if (type == WStype_CONNECTED) {
    Serial.println("API connected");
    return;
  }
  if (type == WStype_DISCONNECTED) {
    Serial.println("API disconnected");
    return;
  }
  if (type != WStype_TEXT) {
    return;
  }
  JsonDocument document;
  if (deserializeJson(document, payload, length) != DeserializationError::Ok) {
    return;
  }
  const char* messageType = document["type"] | "";
  if (strcmp(messageType, "ping") == 0) {
    JsonDocument pong;
    pong["type"] = "pong";
    pong["serverUs"] = document["serverUs"].as<uint64_t>();
    pong["monoUs"] = static_cast<uint64_t>(esp_timer_get_time());
    String body;
    serializeJson(pong, body);
    socketClient.sendTXT(body);
  } else if (strcmp(messageType, "ack") == 0) {
    dropAcked(document["seq"] | 0);
  }
}

void connectSocket() {
  const String path = "/api/v1/devices/stream?deviceId=" + deviceId;
  // Nginx serves the API on 443 with a local certificate. Accept that certificate.
  socketClient.beginSSL(serverHost.c_str(), 443, path.c_str());
  socketClient.onEvent(onSocketEvent);
  socketClient.setReconnectInterval(2000);
}

void flushQueue() {
  if (!socketClient.isConnected() || queueTail == queueHead) {
    return;
  }
  const Sample& sample = queueItems[queueTail];
  if (sample.seq == lastSentSeq && millis() - lastSentMs < 400) {
    return;
  }
  JsonDocument document;
  document["type"] = "sample";
  document["seq"] = sample.seq;
  document["monoUs"] = sample.monoUs;
  document["revCount"] = sample.revCount;
  document["dtUs"] = sample.dtUs;
  if (sample.hasHr) {
    document["hrBpm"] = sample.hrBpm;
  }
  String body;
  serializeJson(document, body);
  socketClient.sendTXT(body);
  lastSentSeq = sample.seq;
  lastSentMs = millis();
}

bool hardPhase(uint64_t nowUs) {
  const uint64_t cycleUs = (static_cast<uint64_t>(kEasyMs) + kHardMs) * 1000ULL;
  return (nowUs % cycleUs) >= static_cast<uint64_t>(kEasyMs) * 1000ULL;
}

double targetRpm(uint64_t nowUs) {
  const double base = hardPhase(nowUs) ? kHardRpm : kEasyRpm;
  const double seconds = static_cast<double>(nowUs) / 1000000.0;
  return base + sin(seconds * 1.7) * kWobbleRpm;
}

int nextHeartRate(uint64_t nowUs) {
  const double target = hardPhase(nowUs) ? kHrHard : kHrEasy;
  currentHr += (target - currentHr) * 0.05;
  return static_cast<int>(currentHr + 0.5);
}

void emitRevolution() {
  const uint64_t now = static_cast<uint64_t>(esp_timer_get_time());
  const double rpm = targetRpm(now);
  const uint64_t intervalUs = static_cast<uint64_t>((60.0 * 1000000.0) / rpm);
  if (lastEdgeUs != 0 && now - lastEdgeUs < intervalUs) {
    return;
  }
  const uint64_t dtUs = lastEdgeUs == 0 ? intervalUs : now - lastEdgeUs;
  lastEdgeUs = now;
  const bool hard = hardPhase(now);
  if (hard != wasHard) {
    wasHard = hard;
    Serial.println(hard ? "sim hard block" : "sim easy block");
  }
  const int hr = nextHeartRate(now);
  revCount += 1;
  const Sample sample{nextSeq, now, revCount, dtUs, hr, kSimulateHeartRate};
  if (!enqueue(sample)) {
    revCount -= 1;
    return;
  }
  nextSeq += 1;
  digitalWrite(kLedPin, HIGH);
  ledOffAtMs = millis() + kLedPulseMs;
}

void updateLed() {
  if ((long)(millis() - ledOffAtMs) >= 0) {
    digitalWrite(kLedPin, LOW);
  }
}

void setup() {
  Serial.begin(115200);
  loadSettings();
  pinMode(kLedPin, OUTPUT);
  digitalWrite(kLedPin, LOW);
  Serial.println("Zwish simulator");
  Serial.printf("device %s\n", deviceId.c_str());
  if (wifiSsid.length() == 0 || serverHost.length() == 0) {
    startPortal();
    return;
  }
  Serial.printf("wifi \"%s\" api wss://%s/api/v1/devices/stream\n", wifiSsid.c_str(), serverHost.c_str());
  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiSsid.c_str(), wifiPassword.c_str());
  WiFi.setSleep(false);
}

void loop() {
  updateLed();
  if (wifiSsid.length() == 0 || serverHost.length() == 0) {
    portal.handleClient();
    if (millis() - lastStatusMs >= 5000) {
      lastStatusMs = millis();
      Serial.println("waiting for setup at http://192.168.4.1");
    }
    return;
  }
  if (WiFi.status() == WL_CONNECTED) {
    if (!socketStarted) {
      Serial.print("WiFi IP ");
      Serial.println(WiFi.localIP());
      connectSocket();
      socketStarted = true;
    }
    socketClient.loop();
  }
  emitRevolution();
  flushQueue();
  if (millis() - lastStatusMs >= 5000) {
    lastStatusMs = millis();
    const uint64_t now = static_cast<uint64_t>(esp_timer_get_time());
    Serial.printf("sim %.0f rpm  revs %.0f  hr %d\n", targetRpm(now), revCount, static_cast<int>(currentHr + 0.5));
    if (WiFi.status() != WL_CONNECTED) {
      Serial.printf("WiFi not connected (%d)\n", WiFi.status());
    } else if (!socketClient.isConnected()) {
      Serial.println("API not connected");
    }
  }
}
