/*
 * Smart Water Meter - ESP32 Code
 * Код для отправки данных о потреблении воды на Flask сервер
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ============= НАСТРОЙКИ WiFi =============
const char* ssid = "ВАШ_WIFI_SSID";           // Замените на имя вашей WiFi сети
const char* password = "ВАШ_WIFI_ПАРОЛЬ";     // Замените на пароль WiFi

// ============= НАСТРОЙКИ СЕРВЕРА =============
const char* serverURL = "http://192.168.1.100:5000/receive_data";  // Замените IP на адрес вашего компьютера
// Чтобы узнать IP адрес вашего ПК:
// Windows: откройте командную строку и введите: ipconfig
// Найдите "IPv4 Address" для вашего WiFi адаптера

// ============= НАСТРОЙКИ ДАТЧИКА =============
const int FLOW_SENSOR_PIN = 2;  // Пин для датчика потока воды
volatile int pulseCount = 0;     // Счетчик импульсов от датчика
float calibrationFactor = 4.5;   // Калибровочный коэффициент (импульсов на литр)
                                 // Настройте под ваш датчик (обычно 4.5-7.5)

unsigned long oldTime = 0;
float totalLiters = 0;
float flowRate = 0;

// ============= ФУНКЦИЯ ПОДСЧЕТА ИМПУЛЬСОВ =============
void IRAM_ATTR pulseCounter() {
  pulseCount++;
}

// ============= ОТПРАВКА ДАННЫХ НА СЕРВЕР =============
void sendDataToServer(float liters) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    
    // Начинаем HTTP соединение
    http.begin(serverURL);
    http.addHeader("Content-Type", "application/json");
    
    // Создаем JSON документ
    StaticJsonDocument<200> doc;
    doc["liters"] = liters;
    
    // Сериализуем JSON в строку
    String jsonString;
    serializeJson(doc, jsonString);
    
    // Отправляем POST запрос
    Serial.println("Отправка данных на сервер...");
    Serial.println("JSON: " + jsonString);
    
    int httpResponseCode = http.POST(jsonString);
    
    // Проверяем ответ
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("Код ответа: " + String(httpResponseCode));
      Serial.println("Ответ сервера: " + response);
    } else {
      Serial.println("Ошибка отправки: " + String(httpResponseCode));
    }
    
    http.end();
  } else {
    Serial.println("WiFi не подключен!");
  }
}

// ============= SETUP =============
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n=================================");
  Serial.println("Smart Water Meter - ESP32");
  Serial.println("=================================\n");
  
  // Настройка пина датчика
  pinMode(FLOW_SENSOR_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN), pulseCounter, FALLING);
  
  // Подключение к WiFi
  Serial.print("Подключение к WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✓ WiFi подключен!");
    Serial.print("IP адрес ESP32: ");
    Serial.println(WiFi.localIP());
    Serial.print("Сервер: ");
    Serial.println(serverURL);
    Serial.println("=================================\n");
  } else {
    Serial.println("\n✗ Не удалось подключиться к WiFi!");
    Serial.println("Проверьте SSID и пароль в коде");
  }
  
  oldTime = millis();
}

// ============= LOOP =============
void loop() {
  // Каждую секунду рассчитываем расход
  if ((millis() - oldTime) > 1000) {
    
    // Отключаем прерывания для безопасного чтения
    detachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN));
    
    // Рассчитываем расход (литров в минуту)
    flowRate = ((1000.0 / (millis() - oldTime)) * pulseCount) / calibrationFactor;
    
    // Рассчитываем количество литров за этот период
    float litersThisSecond = (pulseCount / calibrationFactor);
    totalLiters += litersThisSecond;
    
    // Выводим информацию
    Serial.print("Импульсов: ");
    Serial.print(pulseCount);
    Serial.print("\t | Расход: ");
    Serial.print(flowRate, 2);
    Serial.print(" л/мин");
    Serial.print("\t | Всего: ");
    Serial.print(totalLiters, 2);
    Serial.println(" л");
    
    // Если есть поток воды, отправляем данные на сервер
    if (litersThisSecond > 0) {
      sendDataToServer(litersThisSecond);
    }
    
    // Сбрасываем счетчик
    pulseCount = 0;
    oldTime = millis();
    
    // Включаем прерывания обратно
    attachInterrupt(digitalPinToInterrupt(FLOW_SENSOR_PIN), pulseCounter, FALLING);
  }
  
  // Небольшая задержка
  delay(100);
}

/*
 * ============= ИНСТРУКЦИИ ПО УСТАНОВКЕ =============
 * 
 * 1. УСТАНОВКА БИБЛИОТЕК В ARDUINO IDE:
 *    - Откройте Arduino IDE
 *    - Меню: Скетч → Подключить библиотеку → Управление библиотеками
 *    - Найдите и установите:
 *      • ArduinoJson (by Benoit Blanchon)
 *    - WiFi и HTTPClient уже встроены для ESP32
 * 
 * 2. НАСТРОЙКА ESP32 В ARDUINO IDE:
 *    - Меню: Файл → Настройки
 *    - Дополнительные ссылки для менеджера плат:
 *      https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
 *    - Меню: Инструменты → Плата → Менеджер плат
 *    - Найдите "esp32" и установите "ESP32 by Espressif Systems"
 *    - Меню: Инструменты → Плата → ESP32 Arduino → выберите вашу модель (например, ESP32 Dev Module)
 * 
 * 3. НАСТРОЙКА КОДА:
 *    - Измените ssid и password на ваши WiFi данные
 *    - Измените serverURL - замените 192.168.1.100 на IP вашего компьютера
 *    - Настройте FLOW_SENSOR_PIN под ваш пин подключения датчика
 *    - Настройте calibrationFactor под ваш датчик (см. документацию датчика)
 * 
 * 4. ПОДКЛЮЧЕНИЕ ДАТЧИКА ПОТОКА:
 *    - Красный провод → 5V или 3.3V (зависит от датчика)
 *    - Черный провод → GND
 *    - Желтый провод (сигнал) → GPIO 2 (или другой пин, указанный в FLOW_SENSOR_PIN)
 * 
 * 5. ЗАГРУЗКА КОДА:
 *    - Подключите ESP32 к компьютеру через USB
 *    - Выберите правильный порт: Инструменты → Порт → COMx
 *    - Нажмите кнопку "Загрузить" (стрелка вправо)
 * 
 * 6. ПРОВЕРКА РАБОТЫ:
 *    - Откройте монитор порта: Инструменты → Монитор порта (Ctrl+Shift+M)
 *    - Скорость: 115200 бaud
 *    - Проверьте сообщения о подключении к WiFi
 *    - Проверьте отправку данных на сервер
 * 
 * 7. ЗАПУСК СЕРВЕРА:
 *    - Перед загрузкой кода убедитесь, что Flask сервер запущен
 *    - Откройте командную строку на ПК
 *    - Перейдите в папку проекта: cd "c:\Users\Admin\Desktop\Датчик воды"
 *    - Запустите: python app.py (или py app.py)
 *    - Сервер должен быть доступен на http://ВАШИ_IP:5000
 * 
 * ============= РЕШЕНИЕ ПРОБЛЕМ =============
 * 
 * Проблема: ESP32 не подключается к WiFi
 * Решение: Проверьте SSID и пароль, убедитесь что WiFi работает на 2.4GHz (не 5GHz)
 * 
 * Проблема: Ошибка отправки данных (-1 или другой код)
 * Решение: Проверьте IP адрес сервера, убедитесь что ПК и ESP32 в одной сети
 * 
 * Проблема: Датчик не считает импульсы
 * Решение: Проверьте подключение проводов, попробуйте другой GPIO пин
 * 
 * Проблема: Неправильные показания литров
 * Решение: Настройте calibrationFactor под ваш датчик (см. datasheet)
 * 
 * ============= ТЕСТИРОВАНИЕ БЕЗ ДАТЧИКА =============
 * 
 * Если у вас пока нет датчика, замените код в loop() на тестовый:
 * 
 * void loop() {
 *   delay(5000);  // Каждые 5 секунд
 *   float testLiters = random(1, 5);  // Случайное значение 1-5 литров
 *   Serial.print("Тестовая отправка: ");
 *   Serial.print(testLiters);
 *   Serial.println(" л");
 *   sendDataToServer(testLiters);
 * }
 * 
 */
