# 📬 Руководство по API получения почты и OTP-кодов (`djelu.site`)

Сервис предназначен для автоматизации регистрации аккаунтов, E2E-тестирования и быстрого получения входящих писем, кодов верификации (OTP) и ссылок активации **без использования браузера**.

---

## 1. Как это работает (Catch-All)

На домене `djelu.site` включен режим **Catch-All**.  
Вы можете генерировать **любой случайный email-адрес** на этом домене:
> `user_abc123@djelu.site`, `gitlab_test_99@djelu.site`, `random_string@djelu.site` и т.д.

Письмо на любой из этих адресов мгновенно принимается сервером и становится доступно через REST API.

---

## 2. Параметры подключения

- **Базовый URL:** `https://mail.djelu.site/api/v1`
- **Авторизация:** Заголовок `Authorization: Bearer sk-mail-api-djelu-secure-token-2026`  
  *(или query-параметр в URL: `?token=sk-mail-api-djelu-secure-token-2026`)*

---

## 3. Основные эндпоинты

### ⭐️ 3.1. Ожидание письма (Long-Polling) — *Основной метод для скриптов*

Отправляет запрос и **ждет поступления письма в реальном времени**.  
Как только письмо приходит на сервер, API возвращает его за **< 5 миллисекунд**. Вам больше не нужно писать циклы с `sleep()` в кодовой базе.

```http
GET https://mail.djelu.site/api/v1/emails/wait?to={EMAIL}&timeout=30
```

- **Параметры:**
  - `to` *(обязательный)* — email-адрес получателя (например, `user123@djelu.site`).
  - `timeout` *(опционально, default: 30)* — максимальное время ожидания в секундах (от 1 до 120).

---

### 3.2. Получение последнего письма (Мгновенно)

Возвращает самое последнее письмо, которое уже находится в ящике.

```http
GET https://mail.djelu.site/api/v1/emails/latest?to={EMAIL}
```

- **Параметры:**
  - `to` *(опционально)* — фильтр по конкретному адресу. Если не указан, вернет вообще последнее письмо в ящике.

---

### 3.3. Список последних писем

Возвращает список последних N писем с сортировкой от новых к старым.

```http
GET https://mail.djelu.site/api/v1/emails/list?to={EMAIL}&limit=10
```

---

## 4. Формат ответа JSON

API автоматически парсит тело письма и извлекает код подтверждения (`otp_code`) и ссылку активации (`verification_url`).

```json
{
  "success": true,
  "data": {
    "id": "1787909231.M495278P259062",
    "to": "user123@djelu.site",
    "from": "GitLab <gitlab@mg.gitlab.com>",
    "subject": "Confirm your email address",
    "date": "2026-08-28T12:16:39+03:00",
    "received_at": "2026-08-28T12:27:11.493605+03:00",
    "otp_code": "929644",
    "verification_url": "https://gitlab.com/users/confirmation?token=...",
    "text": "Before you finish creating your account, enter code 929644...",
    "html": "<p>Before you finish creating your account, enter code <b>929644</b>...</p>"
  },
  "message": null
}
```

### Описание полей:
- `to` — кому предназначалось письмо.
- `from` — отправитель (имя и email).
- `subject` — тема письма.
- `date` / `received_at` — время отправки и точное время сохранения на сервере (ISO формат).
- `otp_code` — готовый 4–8 значный верификационный код.
- `verification_url` — ссылка для подтверждения регистрации (если есть в письме).
- `text` / `html` — полный текст и HTML-версия письма.

---

## 5. Примеры кода для интеграции

### 🐍 Python (requests)

```python
import requests

MAIL_API_URL = "https://mail.djelu.site/api/v1"
MAIL_TOKEN = "sk-mail-api-djelu-secure-token-2026"
HEADERS = {"Authorization": f"Bearer {MAIL_TOKEN}"}

def wait_for_otp(email_address: str, timeout: int = 30) -> str:
    """Ожидает поступление письма и возвращает OTP-код подтверждения."""
    response = requests.get(
        f"{MAIL_API_URL}/emails/wait",
        headers=HEADERS,
        params={"to": email_address, "timeout": timeout},
        timeout=timeout + 5
    )
    res = response.json()
    
    if res.get("success") and res.get("data"):
        data = res["data"]
        print(f"[{data['date']}] Получено письмо от {data['from']}")
        print(f"Код верификации: {data['otp_code']}")
        return data.get("otp_code")
        
    raise TimeoutError(f"Письмо на {email_address} не поступило за {timeout} сек.")

# Пример использования:
# code = wait_for_otp("my_new_user_123@djelu.site", timeout=30)
```

---

### 🟨 TypeScript / JavaScript (Node.js)

```typescript
const MAIL_API_URL = "https://mail.djelu.site/api/v1";
const MAIL_TOKEN = "sk-mail-api-djelu-secure-token-2026";

async function waitEmailCode(email: string, timeoutSec: number = 30): Promise<string> {
  const url = `${MAIL_API_URL}/emails/wait?to=${encodeURIComponent(email)}&timeout=${timeoutSec}`;
  
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${MAIL_TOKEN}` }
  });
  const json = await response.json();

  if (json.success && json.data?.otp_code) {
    return json.data.otp_code;
  }
  throw new Error(json.message || `No OTP code received for ${email}`);
}

// Пример использования:
// const code = await waitEmailCode("test_user_777@djelu.site", 30);
```

---

### 💻 cURL / Bash

```bash
# Ожидание письма и вывод только кода подтверждения:
curl -s -H "Authorization: Bearer sk-mail-api-djelu-secure-token-2026" \
  "https://mail.djelu.site/api/v1/emails/wait?to=user123@djelu.site&timeout=30" | jq -r .data.otp_code
```

---

## 6. Веб-интерфейс (Если нужно посмотреть письмо глазами)

Если требуется вручную открыть почтовый ящик через веб-интерфейс:
- **URL:** [https://mail.djelu.site/](https://mail.djelu.site/)
- **Email:** `admin@djelu.site`
- **Пароль:** `DBshirke33333333`
