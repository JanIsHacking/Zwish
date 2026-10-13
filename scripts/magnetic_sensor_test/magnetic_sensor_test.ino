/*
 * ESP32 test for a two-wire bike speed sensor (Sigma-style reed switch).
 *
 * The switch is normally open. A magnet closes it for a moment; the two
 * wires have no polarity.
 *
 * Wiring:
 *   sensor wire 1 -> GPIO 32
 *   sensor wire 2 -> GND
 *
 * GPIO 32 uses the internal pull-up, so no resistor is required.
 * It is an ADC1 pin, so WiFi does not take it. GPIO 4 and 12 are ADC2.
 *   no magnet: pin HIGH, state OPEN
 *   magnet:    pin LOW,  state CLOSED
 *
 * Onboard LED (GPIO 2 on a typical DevKit) lights while the switch is
 * closed, and stays on at least 50 ms so a fast pass is still visible.
 *
 * Flash with the Arduino IDE:
 *   1. Install the ESP32 board package from Espressif.
 *   2. Open this sketch (the folder name must match the file name).
 *   3. Board: "ESP32 Dev Module". Select the board's serial port.
 *   4. Upload, then open Serial Monitor at 115200 baud.
 *
 * Each new closure prints one "magnet" line. A second falling edge within
 * DEBOUNCE_MS is contact bounce and is ignored. That window is 20 ms, so
 * the next revolution can arrive after that: 3000 RPM is still counted.
 * Moving a magnet past the reed by hand is slower than that and can close
 * it twice for real; those both count.
 *
 * Fill in WIFI_SSID and WIFI_PASSWORD before flashing. Setup logs whether
 * the connection succeeded, then the sensor test continues either way.
 */

#include <WiFi.h>

static const char* WIFI_SSID = "YOUR_WIFI_SSID";
static const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
static const unsigned long WIFI_TIMEOUT_MS = 15000;

static const int SENSOR_PIN = 32;
static const int LED_PIN = 2;
static const unsigned long DEBOUNCE_MS = 20;
static const unsigned long LED_MIN_ON_MS = 50;
static const unsigned long STATUS_INTERVAL_MS = 5000;

volatile uint32_t rawFallCount = 0;

uint32_t lastSeenFalls = 0;
uint32_t magnetCount = 0;
unsigned long lastMagnetMs = 0;
unsigned long ledOffAtMs = 0;
unsigned long lastStatusMs = 0;

void IRAM_ATTR onSensorFall() {
  rawFallCount++;
}

const char* wifiStatusName(wl_status_t status) {
  switch (status) {
    case WL_IDLE_STATUS:
      return "idle";
    case WL_NO_SSID_AVAIL:
      return "ssid not found";
    case WL_SCAN_COMPLETED:
      return "scan completed";
    case WL_CONNECTED:
      return "connected";
    case WL_CONNECT_FAILED:
      return "connect failed";
    case WL_CONNECTION_LOST:
      return "connection lost";
    case WL_DISCONNECTED:
      return "disconnected";
    default:
      return "unknown";
  }
}

void connectWifi() {
  if (strcmp(WIFI_SSID, "YOUR_WIFI_SSID") == 0 || WIFI_SSID[0] == '\0') {
    Serial.println("WiFi connection failed (SSID not set)");
    return;
  }

  Serial.printf("WiFi connecting to \"%s\"...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  const unsigned long startedMs = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - startedMs) < WIFI_TIMEOUT_MS) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();

  const wl_status_t status = WiFi.status();
  if (status == WL_CONNECTED) {
    Serial.print("WiFi connected, IP ");
    Serial.println(WiFi.localIP());
    return;
  }

  Serial.printf("WiFi connection failed (%s)\n", wifiStatusName(status));
}

void setup() {
  Serial.begin(115200);
  pinMode(SENSOR_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  attachInterrupt(digitalPinToInterrupt(SENSOR_PIN), onSensorFall, FALLING);

  Serial.println();
  Serial.println("Magnetic sensor test");
  Serial.println("Sensor between GPIO 32 and GND (internal pull-up).");
  Serial.println("OPEN = no magnet. CLOSED = magnet present.");
  Serial.println();

  connectWifi();

  Serial.println(digitalRead(SENSOR_PIN) == LOW ? "CLOSED" : "OPEN");
  Serial.println();
}

void loop() {
  const unsigned long now = millis();
  const int level = digitalRead(SENSOR_PIN);

  uint32_t falls;
  noInterrupts();
  falls = rawFallCount;
  interrupts();

  if (falls != lastSeenFalls) {
    const unsigned long gapMs = lastMagnetMs == 0 ? 0 : (now - lastMagnetMs);
    if (lastMagnetMs == 0 || gapMs >= DEBOUNCE_MS) {
      magnetCount++;
      Serial.printf("magnet %lu", magnetCount);
      if (lastMagnetMs != 0) {
        const float rpm = 60000.0f / (float)gapMs;
        Serial.printf("  gap %lu ms  rpm %.1f", gapMs, rpm);
      }
      Serial.println();
      lastMagnetMs = now;
    }
    lastSeenFalls = falls;
  }

  if (level == LOW) {
    digitalWrite(LED_PIN, HIGH);
    ledOffAtMs = now + LED_MIN_ON_MS;
  } else if ((long)(now - ledOffAtMs) >= 0) {
    digitalWrite(LED_PIN, LOW);
  }

  if ((now - lastStatusMs) >= STATUS_INTERVAL_MS) {
    lastStatusMs = now;
    Serial.printf("pin=%s  magnets=%lu  wifi=%s\n",
                  level == LOW ? "LOW" : "HIGH",
                  magnetCount,
                  wifiStatusName(WiFi.status()));
  }
}
