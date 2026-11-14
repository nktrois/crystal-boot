// Plays a Crystal Boot animation (crystal_boot.h) on an SPI screen at startup.
// Replace crystal_boot.h with the one downloaded from the web page.
//
// Libraries (Arduino library manager): Adafruit GFX + the driver of your screen.
// Default: Waveshare 1.5" RGB OLED, SSD1351, 128 x 128.

#include <SPI.h>
#include <Adafruit_GFX.h>
#include "crystal_boot.h"

// ---- Screen: keep ONE block ----
#include <Adafruit_SSD1351.h>
#define SCREEN_W 128
#define SCREEN_H 128
#define PIN_SCLK 18
#define PIN_MOSI 23
#define PIN_CS   5
#define PIN_DC   4
#define PIN_RST  32
Adafruit_SSD1351 tft(SCREEN_W, SCREEN_H, &SPI, PIN_CS, PIN_DC, PIN_RST);
#define SCREEN_BEGIN() tft.begin()

// #include <Adafruit_ILI9341.h>          // 320 x 240 TFT
// #define SCREEN_W 320
// #define SCREEN_H 240
// #define PIN_SCLK 18
// #define PIN_MOSI 23
// #define PIN_CS   5
// #define PIN_DC   4
// #define PIN_RST  32
// Adafruit_ILI9341 tft(PIN_CS, PIN_DC, PIN_RST);
// #define SCREEN_BEGIN() do { tft.begin(); tft.setRotation(1); } while (0)
// ---------------------------------

// Draws one frame, centered on the screen, straight from flash.
void drawFrame(uint16_t frame) {
  const int16_t x0 = (tft.width() - CRYSTAL_BOOT_WIDTH) / 2;
  const int16_t y0 = (tft.height() - CRYSTAL_BOOT_HEIGHT) / 2;
  uint32_t p = crystal_boot_offsets[frame];
  const uint32_t end = crystal_boot_offsets[frame + 1];
  tft.startWrite();
  tft.setAddrWindow(x0, y0, CRYSTAL_BOOT_WIDTH, CRYSTAL_BOOT_HEIGHT);
  while (p < end) {
    tft.writeColor(crystal_boot_palette[crystal_boot_data[p + 1]], crystal_boot_data[p]);
    p += 2;
  }
  tft.endWrite();
}

// Plays the animation once, at its own frame rate. Returns early if the screen is too small.
bool playBoot() {
  if (tft.width() < CRYSTAL_BOOT_WIDTH || tft.height() < CRYSTAL_BOOT_HEIGHT) return false;
  const uint32_t period = 1000UL / CRYSTAL_BOOT_FPS;
  uint32_t next = millis();
  for (uint16_t f = 0; f < CRYSTAL_BOOT_FRAMES; f++) {
    drawFrame(f);
    next += period;
    int32_t wait = (int32_t)(next - millis());
    if (wait > 0) delay(wait);
  }
  return true;
}

void setup() {
  Serial.begin(115200);
  SPI.begin(PIN_SCLK, -1, PIN_MOSI, PIN_CS);
  SCREEN_BEGIN();
  tft.fillScreen(0x0000);
  if (!playBoot()) Serial.println("crystal_boot.h is larger than the screen: export it at the screen size.");
  // Your program starts here, after the boot animation.
}

void loop() {
#if CRYSTAL_BOOT_LOOP
  playBoot();
#endif
}
