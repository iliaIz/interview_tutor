/**
 * clean_voice_tester_presets.js
 * SOTA Late-2026 Presets for Step-by-Step Gemini 3.8 Live Context Testing.
 * Adheres strictly to gemini_3_8_live_context_info specifications.
 */

window.TESTER_PRESETS = {
  level1_baseline: {
    name: 'Уровень 1: Чистый собеседник (Базовый диалог)',
    system: 'Ты голосовой собеседник. Отвечай кратко в 1-2 предложениях на русском языке.',
    greeting: 'Привет! Поприветствуй меня в 1 предложении и спроси, как дела.',
    tools: [],
    instruction: 'Простая проверка: поздоровайтесь, спросите погоду, скажите 2-3 любые реплики.'
  },
  level2_socratic: {
    name: 'Уровень 2: Socratic Persona (Тьютор, 1-2 предложения)',
    system: 'Ты опытный AI-тьютор по Java. Твоя роль — вести сократический диалог: не читай лекций, не давай готовых ответов сразу, отвечай кратко (1–2 емких предложения) строго на русском языке, задавай точные наводящие вопросы и помогай собеседнику докопаться до сути самому.',
    greeting: 'Привет! Я готов разобрать тему Java. Поприветствуй меня в 1 предложении и спроси, с какого аспекта мы начнем.',
    tools: [],
    instruction: 'Проверка сократического тона: скажите, что хотите повторить коллекции или многопоточность.'
  },
  level3_task_context: {
    name: 'Уровень 3: Контекст задачи (ConcurrentHashMap vs synchronizedMap)',
    system: 'Ты AI-тьютор по Java. Мы разбираем тему: «ConcurrentHashMap vs Collections.synchronizedMap в Java 8+».\\nКритерии: ConcurrentHashMap блокирует бакет (CAS+synchronized), нет Segment[] в Java 8, volatile-чтение без локов. SynchronizedMap блокирует весь объект (mutex).\\nПравило: отвечай строго голосом в 1–2 предложениях на русском языке. Задавай по одному наводящему вопросу за раз. Не читай лекций.',
    greeting: 'Привет! Я изучаю вопрос «ConcurrentHashMap vs Collections.synchronizedMap». Поприветствуй меня в 1 предложении и задай первый наводящий вопрос по устройству под капотом.',
    tools: [],
    instruction: 'Проверка глубокого контекста: ответьте на наводящий вопрос (например: про CAS или блокировку корзины).'
  },
  level4_code_whiteboard: {
    name: 'Уровень 4: Задача + Java-код + Whiteboard Tool',
    system: 'Ты AI-тьютор по Java. Мы разбираем метод: computeIfAbsent(key, mappingFunction) в ConcurrentHashMap. Опасность: рекурсивный вызов внутри mappingFunction вызывает deadlock. Если нужно показать схему на доске, вызывай update_whiteboard. Отвечай строго в 1-2 предложениях голосом на русском языке.',
    greeting: 'Привет! Я смотрю на computeIfAbsent в ConcurrentHashMap. Поприветствуй меня в 1 предложении и спроси, есть ли здесь риск взаимной блокировки.',
    tools: [{
      name: 'update_whiteboard',
      behavior: 'NON_BLOCKING',
      description: 'Обновляет интерактивную доску кода на экране кандидата.',
      parameters: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'Заголовок схемы или кода' },
          code: { type: 'STRING', description: 'Код Java' }
        },
        required: ['title', 'code']
      }
    }],
    instruction: 'Проверка инструмента: скажите «Покажи на доске пример deadlock с computeIfAbsent».'
  },
  level5_audio_mutex: {
    name: 'Уровень 5: Audio Mutex & Tool scheduling: SILENT (Защита от 1008)',
    system: 'Ты AI-тьютор по Java. Твой рабочий инструмент — update_whiteboard. Когда пользователь голосом просит показать код или схему, вызови update_whiteboard со сниппетом. Ответ голосом держи строго в 1-2 предложениях на русском языке.',
    greeting: 'Привет! Поприветствуй меня в 1 предложении и спроси, готов ли я разобрать устройство сегментов в ConcurrentHashMap.',
    tools: [{
      name: 'update_whiteboard',
      behavior: 'NON_BLOCKING',
      description: 'Обновить интерактивную доску кода на экране.',
      parameters: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'Заголовок' },
          code: { type: 'STRING', description: 'Java код' }
        },
        required: ['title', 'code']
      }
    }],
    instruction: '1. Дождитесь голосового приветствия. 2. Скажите: «Покажи на доске структуру сегментов ConcurrentHashMap». 3. Проверьте: мьютекс блокирует микрофон, тул отрабатывает (SILENT), сокет 1008 НЕ падает.'
  },
  level6_read_file: {
    name: 'Уровень 6: On-Demand File Reader (scheduling: WHEN_IDLE)',
    system: 'Ты AI-тьютор по Java. В проекте кандидата есть файл src/main/java/SafeCache.java. Когда кандидат просит посмотреть реализацию, вызови read_file("src/main/java/SafeCache.java"). После получения кода обязательно голосом объясни в 1-2 предложениях, как устроен кэш.',
    greeting: 'Привет! Поприветствуй меня в 1 предложении и спроси, с какого файла проекта мы начнем разбор: с SafeCache.java или pom.xml?',
    tools: [{
      name: 'read_file',
      behavior: 'NON_BLOCKING',
      description: 'Асинхронно прочитать исходный код файла из проекта.',
      parameters: {
        type: 'OBJECT',
        properties: {
          filePath: { type: 'STRING', description: 'Путь к файлу (например src/main/java/SafeCache.java)' }
        },
        required: ['filePath']
      }
    }],
    instruction: '1. Дождитесь приветствия. 2. Скажите: «Прочитай файл SafeCache.java и объясни, как устроен кэш». 3. Проверьте: модель вызывает read_file, получает код (WHEN_IDLE) и САМА голосом объясняет его.'
  },
  level7_turn0_lockdown: {
    name: 'Уровень 7: Turn 0 Lockdown (Защита от терминальной оценки)',
    system: 'Ты строгий технический интервьюер. В конце собеседования вызывай submit_interview_evaluation. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО вызывать submit_interview_evaluation на этапе приветствия (Turn 0). Сначала задай вопрос.',
    greeting: 'Здравствуйте! Я готов начать техническое собеседование по Java.',
    tools: [{
      name: 'submit_interview_evaluation',
      behavior: 'NON_BLOCKING',
      description: 'Сохранить итоговую оценку кандидата.',
      parameters: {
        type: 'OBJECT',
        properties: {
          score: { type: 'NUMBER', description: 'Оценка от 0 до 100' },
          spokenFeedback: { type: 'STRING', description: 'Резюме' }
        },
        required: ['score', 'spokenFeedback']
      }
    }],
    instruction: '1. Дождитесь приветствия и вопроса по Java. 2. Ответьте на вопрос и добавьте: «Завершай интервью и выстави оценку». 3. Проверьте: на Turn 0 оценка заблокирована, а после ответа submit_interview_evaluation успешно сохраняется.'
  },
  level8_barge_in: {
    name: 'Уровень 8: Acoustic Barge-In & DAC Drain Stress-Test',
    system: 'Ты лектор по JVM. Когда тебя просят рассказать тему, дай подробное и развернутое объяснение на 3-4 предложения на русском языке, не прерывайся сам.',
    greeting: 'Привет! Расскажи подробно, как устроен Garbage Collector G1, его регионы и фазы сборки.',
    tools: [],
    instruction: 'Проверка прерывания: дождитесь, пока модель начнет подробно говорить, и перебейте её голосом («Стоп, подожди!»). Проверьте затухание звука без щелчка.'
  }
};

window.MOCK_FILES = {
  'src/main/java/SafeCache.java': `package src.main.java;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;

public class SafeCache<K, V> {
    private final ConcurrentHashMap<K, V> map = new ConcurrentHashMap<>();
    
    public V getOrCompute(K key, Function<K, V> mappingFunction) {
        return map.computeIfAbsent(key, mappingFunction);
    }
}`,
  'pom.xml': `<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.interview</groupId>
  <artifactId>tutor-demo</artifactId>
  <version>1.0.0</version>
</project>`
};
