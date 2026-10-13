/*
 * Zwish sensor firmware. Open this file in the Arduino IDE.
 * The sketch folder must stay named Zwish, same as this file.
 *
 * Board package: ESP32 by Espressif (Boards Manager).
 * Board: "ESP32 Dev Module". Port: the board's serial port. Upload speed 115200.
 *
 * Libraries (Library Manager):
 *   ArduinoJson by Benoit Blanchon
 *   WebSockets by Markus Sattler
 *
 * Wiring: reed switch between GPIO 32 and GND. Onboard LED is GPIO 2.
 * On first boot the board opens a WiFi setup page and shows the device id.
 */

#include <Arduino.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <WebServer.h>
#include <WebSocketsClient.h>
#include <WiFi.h>
#include <driver/gpio.h>
#include <esp_timer.h>

constexpr int kHallPin = 32;
constexpr int kLedPin = 2;
constexpr int kQueueLength = 48;
// Reed switch, normally open, between GPIO 32 and GND. Internal pull-up.
// GPIO 32 is ADC1, so WiFi can run without taking the pin. GPIO 4 and 12
// are ADC2 and the radio claims them. GPIO 12 is also a boot strap.
// A second falling edge inside this window is contact bounce.
constexpr uint64_t kDebounceUs = 20000;
constexpr unsigned long kLedMinOnMs = 50;

struct Sample {
  uint32_t seq;
  uint64_t monoUs;
  double revCount;
  uint64_t dtUs;
};

Preferences preferences;
WebServer portal(80);
WebSocketsClient socketClient;

String deviceId;
String wifiSsid;
String wifiPassword;
String serverHost;
int magnets = 1;

Sample queueItems[kQueueLength];
int queueHead = 0;
int queueTail = 0;
uint32_t nextSeq = 1;
uint32_t ackedSeq = 0;
double revCount = 0;
int magnetsSeen = 0;
uint64_t revolutionDtUs = 0;

constexpr int kPulseRing = 32;
portMUX_TYPE pulseMux = portMUX_INITIALIZER_UNLOCKED;
volatile uint64_t pulseEdges[kPulseRing];
volatile int pulseWrite = 0;
volatile int pulseRead = 0;
uint64_t lastAcceptedUs = 0;
uint32_t lastSentSeq = 0;
unsigned long lastSentMs = 0;
unsigned long ledOffAtMs = 0;
unsigned long lastStatusMs = 0;
bool socketStarted = false;
int lastPinLevel = -1;

void IRAM_ATTR onHall() {
  const uint64_t now = esp_timer_get_time();
  portENTER_CRITICAL_ISR(&pulseMux);
  const int next = (pulseWrite + 1) % kPulseRing;
  if (next != pulseRead) {
    pulseEdges[pulseWrite] = now;
    pulseWrite = next;
  }
  portEXIT_CRITICAL_ISR(&pulseMux);
}

void armSensor() {
  gpio_reset_pin(static_cast<gpio_num_t>(kHallPin));
  pinMode(kHallPin, INPUT_PULLUP);
  pinMode(kLedPin, OUTPUT);
  attachInterrupt(digitalPinToInterrupt(kHallPin), onHall, FALLING);
  WiFi.setSleep(false);
}

void updateSensorLed() {
  const unsigned long now = millis();
  const int level = digitalRead(kHallPin);
  if (level != lastPinLevel) {
    lastPinLevel = level;
    Serial.println(level == LOW ? "pin LOW (closed)" : "pin HIGH (open)");
  }
  if (level == LOW) {
    digitalWrite(kLedPin, HIGH);
    ledOffAtMs = now + kLedMinOnMs;
    return;
  }
  if ((long)(now - ledOffAtMs) >= 0) {
    digitalWrite(kLedPin, LOW);
  }
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
  magnets = preferences.getInt("magnets", 1);
  preferences.end();
  if (magnets < 1) {
    magnets = 1;
  }
}

void handlePortalRoot() {
  const String page = String("<!doctype html><html><body><h1>Zwish ") + deviceId +
                      "</h1><p>Copy this device id into the trainer screen before you save. "
                      "It is generated on the board and is not typed in here.</p>"
                      "<p>The host is the computer running Zwish. This board always connects "
                      "to https on port 443, through nginx. For this machine use 192.168.178.48.</p>"
                      "<form method='POST' action='/save'>"
                      "WiFi name <input name='ssid'><br>"
                      "WiFi password <input name='password' type='password'><br>"
                      "API host <input name='host' value='192.168.178.48'><br>"
                      "Magnets per wheel revolution <input name='magnets' value='1'><br>"
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
  const int magnetCount = formField("magnets").toInt();
  Serial.printf("form ssid \"%s\" password %u chars host \"%s\" (%d fields)\n", ssid.c_str(), password.length(),
                host.c_str(), portal.args());
  if (ssid.length() == 0 || host.length() == 0) {
    Serial.println("form missing wifi name or API host; staying in setup");
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
  const size_t wroteSsid = preferences.putString("ssid", ssid);
  const size_t wrotePassword = preferences.putString("password", password);
  const size_t wroteHost =   preferences.putString("host", host);
  preferences.putInt("magnets", magnetCount > 0 ? magnetCount : 1);
  preferences.end();
  Serial.printf("stored ssid %u bytes, password %u bytes, host %u bytes\n", wroteSsid, wrotePassword, wroteHost);
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
  armSensor();
  Serial.printf("Setup portal %s at %s device %s\n", ap.c_str(), WiFi.softAPIP().toString().c_str(), deviceId.c_str());
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

void drainPulses() {
  while (pulseRead != pulseWrite) {
    uint64_t edge = 0;
    portENTER_CRITICAL(&pulseMux);
    edge = pulseEdges[pulseRead];
    pulseRead = (pulseRead + 1) % kPulseRing;
    portEXIT_CRITICAL(&pulseMux);
    if (lastAcceptedUs != 0 && edge - lastAcceptedUs < kDebounceUs) {
      continue;
    }
    const uint64_t dt = lastAcceptedUs == 0 ? 0 : edge - lastAcceptedUs;
    lastAcceptedUs = edge;
    Serial.printf("magnet gap %llu us\n", static_cast<unsigned long long>(dt));
    if (dt == 0) {
      continue;
    }
    magnetsSeen += 1;
    revolutionDtUs += dt;
    if (magnetsSeen >= magnets) {
      revCount += 1;
      enqueue(Sample{nextSeq++, static_cast<uint64_t>(esp_timer_get_time()), revCount, revolutionDtUs});
      magnetsSeen = 0;
      revolutionDtUs = 0;
    }
  }
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
  String body;
  serializeJson(document, body);
  socketClient.sendTXT(body);
  lastSentSeq = sample.seq;
  lastSentMs = millis();
}

void setup() {
  Serial.begin(115200);
  loadSettings();
  Serial.printf("loaded ssid \"%s\" host \"%s\" wss port 443\n", wifiSsid.c_str(), serverHost.c_str());
  pinMode(kLedPin, OUTPUT);
  digitalWrite(kLedPin, LOW);
  if (wifiSsid.length() == 0 || serverHost.length() == 0) {
    startPortal();
    return;
  }
  Serial.printf("device %s\n", deviceId.c_str());
  Serial.printf("wifi \"%s\" api wss://%s/api/v1/devices/stream\n", wifiSsid.c_str(), serverHost.c_str());
  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiSsid.c_str(), wifiPassword.c_str());
  armSensor();
}

void loop() {
  updateSensorLed();
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
      armSensor();
      connectSocket();
      socketStarted = true;
    }
    socketClient.loop();
  }
  if (millis() - lastStatusMs >= 5000) {
    lastStatusMs = millis();
    Serial.printf("pin=%s\n", digitalRead(kHallPin) == LOW ? "LOW" : "HIGH");
    if (WiFi.status() != WL_CONNECTED) {
      Serial.printf("WiFi not connected (%d)\n", WiFi.status());
    } else if (!socketClient.isConnected()) {
      Serial.println("API not connected");
    }
  }
  drainPulses();
  flushQueue();
}
