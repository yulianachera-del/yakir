/* Якорь — офлайн-самопомощь: сброс напряжения и засыпание.
   Vanilla JS, без зависимостей. Структура файла:
   1. Хранилище настроек        5. Синтез речи
   2. Таймеры с отменой         6. Поток А (дыхание → мышцы → заземление)
   3. Аудио (шум, «тук», тоны)  7. Поток Б (сон, прогрессивное замедление)
   4. Вибро + Wake Lock         8. Навигация и привязка событий            */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  /* ================= 1. Хранилище настроек ================= */
  const Store = {
    get(key, fallback) {
      try { const v = localStorage.getItem('anchor.' + key); return v === null ? fallback : v; }
      catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('anchor.' + key, String(value)); } catch (e) { /* приватный режим */ }
    },
  };

  const settings = {
    feedback: Store.get('feedback', 'sound'),   // sound | vibro | visual
    sleepMode: Store.get('sleepMode', 'count'), // count | words
    // фон для сну: off | brown | rain (стара настройка noise='1' → brown)
    bg: Store.get('sleepBg', Store.get('noise', '0') === '1' ? 'brown' : 'off'),
    voiceCues: Store.get('voiceCues', '1') === '1', // голосові команди в потоці «Скинути напругу»
    lang: Store.get('lang', 'uk'),             // uk | en | ru — мова інтерфейсу й озвучення
    sleepMin: Store.get('sleepMin', '8'),      // 8 | 15 | 25 — тривалість сну
    textSize: Store.get('textSize', 'normal'), // normal | large
    start: Store.get('start', 'home'),         // home | calm | near — що відкривати при запуску
    voiceSpeed: Store.get('voiceSpeed', 'normal'), // normal | slow
    vol: {                                       // low | mid | high — гучність фонових звуків
      noise: Store.get('volNoise', 'mid'), rain: Store.get('volRain', 'mid'), fx: Store.get('volFx', 'mid'),
    },
  };
  if (!['8', '15', '25'].includes(settings.sleepMin)) settings.sleepMin = '8';
  const VOL_GAIN = { low: 0.45, mid: 1, high: 1.6 };
  const VOICE_SPEED = { normal: 1, slow: 0.86 };

  /* ================= 1a. Переклади (UA — основна, далі EN і RU) ================= */
  const I18N = {
    uk: {
      appName: 'Якір',
      intro: 'Працює повністю без інтернету. Допомагає швидко скинути напругу після тривоги або заснути',
      start: 'Почати',
      calmTitle: 'Скинути напругу', calmSub: 'Після тривоги, вибухів або паніки • 4 хвилини',
      near: 'Побути поруч', nearText: 'Я поруч. Нічого не треба робити',
      settings: 'Налаштування', setLang: 'Мова', setIcon: 'Іконка застосунку',
      iconDefault: 'Звичайна', iconBright: 'Помітна', iconCalm: 'Спокійна',
      iconHint: 'Нова іконка з’явиться, коли прибереш «Якір» з головного екрана й додаси знову',
      setUpdate: 'Оновлення', version: 'Версія', updCheck: 'Перевірити оновлення', updApply: 'Оновити зараз',
      updChecking: 'Перевіряю…', updLatest: 'У тебе найновіша версія', updFound: 'Є нова версія. Вона вже завантажена',
      updOffline: 'Немає з’єднання з інтернетом. Спробуй пізніше — застосунок працює й так',
      updNoSupport: 'Оновлення приходять самі, коли телефон в інтернеті',
      setText: 'Розмір тексту', textNormal: 'Звичайний', textLarge: 'Великий',
      setStart: 'Що відкривати при запуску', startHome: 'Головну',
      startHint: 'Одразу потрапиш у вправу, без вибору. На головну — хрестиком',
      setVoice: 'Голос', voiceCuesLbl: 'Голосові підказки', on: 'Увімк.', off: 'Вимк.',
      voiceSpeed: 'Темп', speedSlow: 'Повільніше', speedNormal: 'Звичайно',
      setVolume: 'Гучність фону', volNoise: 'Шум', volRain: 'Дощ', volFx: 'Інші звуки',
      volLow: 'Тихіше', volMid: 'Звичайно', volHigh: 'Гучніше',
      setSleep: 'Тривалість сну', min8: '8 хв', min15: '15 хв', min25: '25 хв',
      sleepDurHint: 'Для відліку й для слів. Потім звук і текст тихо згасають',
      share: 'Поділитися застосунком', shareText: 'Якір — офлайн-самодопомога: скинути напругу й заснути. Безкоштовно, без реклами',
      shareCopied: 'Посилання скопійовано',
      resetAll: 'Скинути всі налаштування і мої дані',
      resetWarn: 'Це видалить «Мою опору» і всі налаштування на цьому телефоні. Повернути їх не вийде',
      resetYes: 'Так, скинути', cancel: 'Скасувати',
      tapToStart: 'Торкнись екрана, щоб почати',
      privacy: 'Приватність', kid: 'Для дитини', kBalloon: 'Гра: кулька', kCandle: 'Гра: свічка',
      kidTip: 'Дорослому: дихайте разом із дитиною, повільно й уголос. Не виправляйте — хваліть за кожен видих',
      kInB: 'Вдихни носиком — набери повітря', kOutB: 'А тепер дуй у кульку!', kDoneB: 'Вийшло! Кулька полетіла',
      kInC: 'Понюхай квіточку', kOutC: 'Тихенько подуй на свічку', kDoneC: 'Чудово! Вогник тобі помахав',
      st4: 'Обійми', noteA4: 'Добре. Наостанок — обійми себе',
      bfText: 'Схрести руки на грудях, долоні під ключицями. Постукуй по черзі: ліва долоня, права — як крила метелика',
      bfHint: 'Телефон можна покласти. Якщо стає важче — зупинись і подивись навколо',
      bfPause: 'Зупинись. Повільний вдих… і видих',
      nsOff: 'Звук вимкнено', nsWaves: 'Звук: хвилі', nsRain: 'Звук: дощ', nsChimes: 'Звук: дзвіночки', nsFire: 'Звук: вогнище',
      feelQ: 'Як ти зараз?', feelTense: 'Ще напружено', feelEased: 'Трохи відпустило', feelSleepy: 'Хочеться спати',
      sugTense: 'Так буває — тілу потрібно більше часу. Пройдімо ще раз, повільно?',
      sugEased: 'Добре. Хочеш перемкнутися на щось легке?',
      sugSleepy: 'Тоді допоможу заснути', goDetox: 'У Детокс',
      anchorTitle: 'Моя опора', anchorOpen: 'Моя опора — фраза для важкої хвилини',
      anchorLead: 'Напиши фразу для себе або ім’я близької людини. Я покажу це у важку хвилину',
      anchorPh: 'Наприклад: «Це мине. Я впораюся»', anchorNote: 'Зберігається лише на цьому телефоні',
      anchorSave: 'Зберегти', anchorClear: 'Прибрати', anchorSaved: 'Збережено. Я нагадаю, коли буде важко',
      back: 'Назад',
      sleepTitle: 'Допомогти заснути', sleepSub: 'Зворотний відлік і вимкнення думок',
      fbSound: 'Звук + Вібро', fbVibro: 'Тільки Вібро', fbVisual: 'Лише візуал',
      feedbackLabel: 'Режим відгуку', langLabel: 'Мова', sleepModeLabel: 'Режим засинання',
      exit: 'Вийти на головний екран', skip: 'Пропустити',
      ready: 'Приготуйся', inhale: 'Вдих носом', topup: 'Довдих', exhale: 'Повільний видих ротом',
      m1t: 'Стисни кулаки й підніми плечі до вух', m1r: 'Різко кинь і розслаб',
      m2t: 'Сильно заплющ очі й стисни зуби', m2r: 'Розслаб обличчя й опусти щелепу',
      m3t: 'Напруж ноги, живіт і спину', m3r: 'Повністю обм’якни',
      g5: 'Знайди поглядом 5 будь-яких предметів навколо й натискай на екран на кожен',
      g4: 'Торкнися 4 різних поверхонь поруч (ковдра, стіна, телефон...)',
      g3: 'Прислухайся до 3 тихих звуків у кімнаті',
      g2: 'Зроби 2 глибокі спокійні видихи',
      g1: 'Відчуй, як тіло спирається на ліжко чи підлогу',
      tapAnywhere: 'Натискай будь-де на екрані',
      finalText: 'Пульс вирівнюється',
      toSleep: 'Перейти до засинання', toHome: 'На головну',
      countTitle: 'Зворотний відлік (100 → 0)', countSub: 'Монотонний рахунок назад, темп сповільнюється',
      wordsTitle: 'Образи (Перемішування)', wordsSub: 'Випадкові спокійні слова, {m} хвилин',
      bgSound: 'Фоновий звук', bgOff: 'Без', bgBrown: 'Шум', bgRain: 'Дощ',
      noteTap: 'Торкнись екрана, щоб почати одразу', voiceLang: 'Мова озвучення',
      sleepStart: 'Заплющити очі й почати',
      hintVisual: 'Режим «Лише візуал»: без голосу, лише тьмяний текст',
      hintNoVoice: 'Голосу для цієї мови на пристрої не знайдено — буде лише текст',
      detox: 'Детокс', detoxBack: 'Назад до Детоксу',
      detoxLead: 'Тут немає завдань і оцінок. Обери те, що зараз ближче',
      dDraw: 'Малювання світлом', dDrawSub: 'Води пальцем — лінії світяться й тануть',
      dGarden: 'Звуковий сад', dGardenSub: 'Торкайся екрана — кожен дотик звучить м’яко',
      dBubbles: 'Бульбашки', dBubblesSub: 'Повільні бульбашки під дощ або хвилі',
      scRain: 'Дощ', scGlass: 'Краплі на склі', scWaves: 'Хвилі',
      dSmile: 'Про те, про се', dSmileSub: 'Знайоме ні про що', smileNext: 'Ще одну',
      dThought: 'Відпустити думку', dThoughtSub: 'Напиши те, що крутиться в голові, і дивись, як воно зникає',
      dStep: 'Маленький крок', dStepSub: 'Одна крихітна дія для себе',
      kaleido: 'Калейдоскоп',
      gardenHint: 'Торкайся будь-де', gardenMuted: 'Звук вимкнено в режимі відгуку — лишилися кола',
      thoughtPh: 'Пиши сюди. Це ніхто не побачить', thoughtGo: 'Відпустити',
      thoughtNote: 'Нічого не зберігається', thoughtDone: 'Відпущено. Можна видихнути',
      stepNext: 'Інший крок', stepNote: 'Лише якщо хочеться',
      st1: 'Дихання', st2: 'Тіло', st3: 'Опора', stagesLabel: 'Етапи практики',
      voiceToggle: 'Голосові команди',
      vInhale: 'Вдих', vTopup: 'Ще трохи', vExhale: 'Видих',
      noteA1: 'Те, що ти зараз відчуваєш, — нормальна реакція тіла. Подихаймо разом',
      noteA2: 'Добре. Тепер відпустимо напругу з тіла',
      noteA3: 'Добре. Тепер повернімося в кімнату, де ти є',
      breathHint: 'Не встигаєш у такт — нічого. Головне — довгий видих',
      muscleHint: 'Напружуй лише до комфортної межі',
      finalSub: 'Якщо тривога ще висока — це нормально. Можна пройти ще раз',
      again: 'Пройти ще раз',
    },
    en: {
      appName: 'Anchor',
      intro: 'Works fully offline. Helps you quickly release tension after an alert, or fall asleep',
      start: 'Start',
      calmTitle: 'Release tension', calmSub: 'After an alert, explosions or panic • 4 minutes',
      near: 'Stay with me', nearText: 'I’m here. You don’t have to do anything',
      settings: 'Settings', setLang: 'Language', setIcon: 'App icon',
      iconDefault: 'Standard', iconBright: 'Bright', iconCalm: 'Calm',
      iconHint: 'The new icon appears after you remove “Anchor” from the home screen and add it again',
      setUpdate: 'Updates', version: 'Version', updCheck: 'Check for updates', updApply: 'Update now',
      updChecking: 'Checking…', updLatest: 'You have the latest version', updFound: 'A new version is ready. It has already downloaded',
      updOffline: 'No internet connection. Try later — the app works anyway',
      updNoSupport: 'Updates arrive on their own when the phone is online',
      setText: 'Text size', textNormal: 'Normal', textLarge: 'Large',
      setStart: 'Open on launch', startHome: 'Home',
      startHint: 'Go straight into the practice, no choosing. ✕ takes you home',
      setVoice: 'Voice', voiceCuesLbl: 'Voice prompts', on: 'On', off: 'Off',
      voiceSpeed: 'Pace', speedSlow: 'Slower', speedNormal: 'Normal',
      setVolume: 'Background volume', volNoise: 'Noise', volRain: 'Rain', volFx: 'Other sounds',
      volLow: 'Quieter', volMid: 'Normal', volHigh: 'Louder',
      setSleep: 'Sleep length', min8: '8 min', min15: '15 min', min25: '25 min',
      sleepDurHint: 'For counting and for words. Then sound and text fade quietly',
      share: 'Share the app', shareText: 'Anchor — offline self-help to release tension and fall asleep. Free, no ads',
      shareCopied: 'Link copied',
      resetAll: 'Reset all settings and my data',
      resetWarn: 'This deletes “My anchor” and all settings on this phone. It can’t be undone',
      resetYes: 'Yes, reset', cancel: 'Cancel',
      tapToStart: 'Tap the screen to begin',
      privacy: 'Privacy', kid: 'For a child', kBalloon: 'Game: balloon', kCandle: 'Game: candle',
      kidTip: 'For the adult: breathe together with the child, slowly and out loud. Don’t correct — praise every breath out',
      kInB: 'Breathe in through your nose — fill up with air', kOutB: 'Now blow into the balloon!', kDoneB: 'You did it! The balloon flew away',
      kInC: 'Smell the flower', kOutC: 'Gently blow on the candle', kDoneC: 'Lovely! The flame waved at you',
      st4: 'Hug', noteA4: 'Good. One last thing — a hug for yourself',
      bfText: 'Cross your arms over your chest, hands just below your collarbones. Tap in turn: left hand, right hand — like butterfly wings',
      bfHint: 'You can put the phone down. If it gets harder, stop and look around you',
      bfPause: 'Pause. A slow breath in… and out',
      nsOff: 'Sound off', nsWaves: 'Sound: waves', nsRain: 'Sound: rain', nsChimes: 'Sound: chimes', nsFire: 'Sound: fireplace',
      feelQ: 'How are you right now?', feelTense: 'Still tense', feelEased: 'A little lighter', feelSleepy: 'I feel sleepy',
      sugTense: 'That happens — the body needs more time. Shall we go through it once more, slowly?',
      sugEased: 'Good. Would you like to switch to something light?',
      sugSleepy: 'Then let me help you fall asleep', goDetox: 'Go to Detox',
      anchorTitle: 'My anchor', anchorOpen: 'My anchor — words for a hard moment',
      anchorLead: 'Write a phrase for yourself, or the name of someone close. I will show it to you in a hard moment',
      anchorPh: 'For example: “This will pass. I can do this”', anchorNote: 'Saved only on this phone',
      anchorSave: 'Save', anchorClear: 'Remove', anchorSaved: 'Saved. I will remind you when it gets hard',
      back: 'Back',
      sleepTitle: 'Help me sleep', sleepSub: 'Countdown and switching off thoughts',
      fbSound: 'Sound + Vibration', fbVibro: 'Vibration only', fbVisual: 'Visual only',
      feedbackLabel: 'Feedback mode', langLabel: 'Language', sleepModeLabel: 'Sleep mode',
      exit: 'Back to home screen', skip: 'Skip',
      ready: 'Get ready', inhale: 'Breathe in through your nose', topup: 'One more sip of air',
      exhale: 'Slow breath out through your mouth',
      m1t: 'Clench your fists and lift your shoulders to your ears', m1r: 'Drop them and let go',
      m2t: 'Squeeze your eyes shut and clench your teeth', m2r: 'Relax your face and let your jaw drop',
      m3t: 'Tense your legs, stomach and back', m3r: 'Go completely limp',
      g5: 'Find 5 objects around you and tap the screen for each one',
      g4: 'Touch 4 different surfaces nearby (blanket, wall, phone...)',
      g3: 'Listen for 3 quiet sounds in the room',
      g2: 'Take 2 deep, calm breaths out',
      g1: 'Feel your body resting on the bed or the floor',
      tapAnywhere: 'Tap anywhere on the screen',
      finalText: 'Your pulse is settling',
      toSleep: 'Continue to sleep', toHome: 'Back to home',
      countTitle: 'Countdown (100 → 0)', countSub: 'Steady counting down, slowing as it goes',
      wordsTitle: 'Images (Shuffle)', wordsSub: 'Random calm words, {m} minutes',
      bgSound: 'Background sound', bgOff: 'None', bgBrown: 'Noise', bgRain: 'Rain',
      noteTap: 'Tap the screen to start right away', voiceLang: 'Voice language',
      sleepStart: 'Close your eyes and start',
      hintVisual: '“Visual only” mode: no voice, only dim text',
      hintNoVoice: 'No voice for this language was found on the device — text only',
      detox: 'Detox', detoxBack: 'Back to Detox',
      detoxLead: 'No tasks, no scores. Pick whatever feels closest right now',
      dDraw: 'Light drawing', dDrawSub: 'Move your finger — lines glow and melt away',
      dGarden: 'Sound garden', dGardenSub: 'Touch the screen — every touch sounds soft',
      dBubbles: 'Bubbles', dBubblesSub: 'Slow bubbles with rain or waves',
      scRain: 'Rain', scGlass: 'Drops on glass', scWaves: 'Waves',
      dSmile: 'This and that', dSmileSub: 'Familiar things about nothing much', smileNext: 'One more',
      dThought: 'Let a thought go', dThoughtSub: 'Write what keeps circling in your head and watch it fade',
      dStep: 'A small step', dStepSub: 'One tiny thing for yourself',
      kaleido: 'Kaleidoscope',
      gardenHint: 'Touch anywhere', gardenMuted: 'Sound is off in the feedback mode — only ripples remain',
      thoughtPh: 'Write here. No one will see it', thoughtGo: 'Let it go',
      thoughtNote: 'Nothing is saved', thoughtDone: 'Released. You can breathe out',
      stepNext: 'Another step', stepNote: 'Only if you feel like it',
      st1: 'Breath', st2: 'Body', st3: 'Ground', stagesLabel: 'Practice steps',
      voiceToggle: 'Voice cues',
      vInhale: 'Breathe in', vTopup: 'A little more', vExhale: 'Breathe out',
      noteA1: 'What you are feeling right now is a normal reaction of the body. Let’s breathe together',
      noteA2: 'Good. Now let’s release the tension from your body',
      noteA3: 'Good. Now let’s come back to the room you are in',
      breathHint: 'Out of rhythm? That’s fine. The long breath out is what matters',
      muscleHint: 'Tense only as far as feels comfortable',
      finalSub: 'If the anxiety is still high, that’s normal. You can go through it once more',
      again: 'Go through it again',
    },
    ru: {
      appName: 'Якорь',
      intro: 'Работает полностью без интернета. Помогает быстро сбросить напряжение после тревоги или уснуть',
      start: 'Начать',
      calmTitle: 'Сбросить напряжение', calmSub: 'После тревоги, взрывов или паники • 4 минуты',
      near: 'Побыть рядом', nearText: 'Я рядом. Ничего не нужно делать',
      settings: 'Настройки', setLang: 'Язык', setIcon: 'Иконка приложения',
      iconDefault: 'Обычная', iconBright: 'Заметная', iconCalm: 'Спокойная',
      iconHint: 'Новая иконка появится, когда уберёшь «Якорь» с главного экрана и добавишь снова',
      setUpdate: 'Обновления', version: 'Версия', updCheck: 'Проверить обновления', updApply: 'Обновить сейчас',
      updChecking: 'Проверяю…', updLatest: 'У тебя самая новая версия', updFound: 'Есть новая версия. Она уже загружена',
      updOffline: 'Нет подключения к интернету. Попробуй позже — приложение работает и так',
      updNoSupport: 'Обновления приходят сами, когда телефон в интернете',
      setText: 'Размер текста', textNormal: 'Обычный', textLarge: 'Крупный',
      setStart: 'Что открывать при запуске', startHome: 'Главную',
      startHint: 'Сразу попадёшь в упражнение, без выбора. На главную — крестиком',
      setVoice: 'Голос', voiceCuesLbl: 'Голосовые подсказки', on: 'Вкл.', off: 'Выкл.',
      voiceSpeed: 'Темп', speedSlow: 'Медленнее', speedNormal: 'Обычно',
      setVolume: 'Громкость фона', volNoise: 'Шум', volRain: 'Дождь', volFx: 'Другие звуки',
      volLow: 'Тише', volMid: 'Обычно', volHigh: 'Громче',
      setSleep: 'Длительность сна', min8: '8 мин', min15: '15 мин', min25: '25 мин',
      sleepDurHint: 'Для отсчёта и для слов. Потом звук и текст тихо гаснут',
      share: 'Поделиться приложением', shareText: 'Якорь — офлайн-самопомощь: снять напряжение и заснуть. Бесплатно, без рекламы',
      shareCopied: 'Ссылка скопирована',
      resetAll: 'Сбросить все настройки и мои данные',
      resetWarn: 'Это удалит «Мою опору» и все настройки на этом телефоне. Вернуть их не получится',
      resetYes: 'Да, сбросить', cancel: 'Отмена',
      tapToStart: 'Коснись экрана, чтобы начать',
      privacy: 'Конфиденциальность', kid: 'Для ребёнка', kBalloon: 'Игра: шарик', kCandle: 'Игра: свеча',
      kidTip: 'Взрослому: дышите вместе с ребёнком, медленно и вслух. Не поправляйте — хвалите за каждый выдох',
      kInB: 'Вдохни носиком — набери воздух', kOutB: 'А теперь дуй в шарик!', kDoneB: 'Получилось! Шарик улетел',
      kInC: 'Понюхай цветочек', kOutC: 'Тихонько подуй на свечу', kDoneC: 'Чудесно! Огонёк тебе помахал',
      st4: 'Объятие', noteA4: 'Хорошо. Напоследок — обними себя',
      bfText: 'Скрести руки на груди, ладони под ключицами. Постукивай по очереди: левая ладонь, правая — как крылья бабочки',
      bfHint: 'Телефон можно положить. Если становится тяжелее — остановись и посмотри вокруг',
      bfPause: 'Остановись. Медленный вдох… и выдох',
      nsOff: 'Звук выключен', nsWaves: 'Звук: волны', nsRain: 'Звук: дождь', nsChimes: 'Звук: колокольчики', nsFire: 'Звук: камин',
      feelQ: 'Как ты сейчас?', feelTense: 'Ещё напряжённо', feelEased: 'Немного отпустило', feelSleepy: 'Хочется спать',
      sugTense: 'Так бывает — телу нужно больше времени. Пройдём ещё раз, медленно?',
      sugEased: 'Хорошо. Хочешь переключиться на что-то лёгкое?',
      sugSleepy: 'Тогда помогу уснуть', goDetox: 'В Детокс',
      anchorTitle: 'Моя опора', anchorOpen: 'Моя опора — фраза для трудной минуты',
      anchorLead: 'Напиши фразу для себя или имя близкого человека. Я покажу это в трудную минуту',
      anchorPh: 'Например: «Это пройдёт. Я справлюсь»', anchorNote: 'Хранится только на этом телефоне',
      anchorSave: 'Сохранить', anchorClear: 'Убрать', anchorSaved: 'Сохранено. Я напомню, когда будет трудно',
      back: 'Назад',
      sleepTitle: 'Помочь уснуть', sleepSub: 'Обратный отсчет и отключение мыслей',
      fbSound: 'Звук + Вибро', fbVibro: 'Только Вибро', fbVisual: 'Только визуал',
      feedbackLabel: 'Режим отклика', langLabel: 'Язык', sleepModeLabel: 'Режим засыпания',
      exit: 'Выйти на главный экран', skip: 'Пропустить',
      ready: 'Приготовься', inhale: 'Вдох носом', topup: 'Довдох', exhale: 'Медленный выдох ртом',
      m1t: 'Сожми кулаки и подними плечи к ушам', m1r: 'Резко брось и расслабь',
      m2t: 'Сильно зажмурь глаза и сожми зубы', m2r: 'Расслабь лицо и опусти челюсть',
      m3t: 'Напряги ноги, живот и спину', m3r: 'Полностью обмякни',
      g5: 'Найди взглядом 5 любых предметов вокруг и нажимай на экран на каждый',
      g4: 'Потрогай 4 разные поверхности рядом (одеяло, стена, телефон...)',
      g3: 'Прислушайся к 3 тихим звукам в комнате',
      g2: 'Сделай 2 глубоких спокойных выдоха',
      g1: 'Почувствуй опору тела о кровать или пол',
      tapAnywhere: 'Нажимай в любом месте экрана',
      finalText: 'Пульс выравнивается',
      toSleep: 'Перейти к засыпанию', toHome: 'На главную',
      countTitle: 'Обратный отсчет (100 → 0)', countSub: 'Монотонный счет назад, темп замедляется',
      wordsTitle: 'Образы (Перемешивание)', wordsSub: 'Случайные спокойные слова, {m} минут',
      bgSound: 'Фоновый звук', bgOff: 'Без', bgBrown: 'Шум', bgRain: 'Дождь',
      noteTap: 'Коснись экрана, чтобы начать сразу', voiceLang: 'Язык озвучки',
      sleepStart: 'Закрыть глаза и начать',
      hintVisual: 'Режим «Только визуал»: без голоса, только тусклый текст',
      hintNoVoice: 'Голос для этого языка не найден на устройстве — будет только текст',
      detox: 'Детокс', detoxBack: 'Назад к Детоксу',
      detoxLead: 'Здесь нет заданий и оценок. Выбери то, что сейчас ближе',
      dDraw: 'Рисование светом', dDrawSub: 'Води пальцем — линии светятся и тают',
      dGarden: 'Звуковой сад', dGardenSub: 'Касайся экрана — каждое касание звучит мягко',
      dBubbles: 'Пузыри', dBubblesSub: 'Медленные пузыри под дождь или волны',
      scRain: 'Дождь', scGlass: 'Капли на стекле', scWaves: 'Волны',
      dSmile: 'Про то, про сё', dSmileSub: 'Ни о чём и обо всём', smileNext: 'Ещё одну',
      dThought: 'Отпустить мысль', dThoughtSub: 'Напиши то, что крутится в голове, и смотри, как оно исчезает',
      dStep: 'Маленький шаг', dStepSub: 'Одно крошечное действие для себя',
      kaleido: 'Калейдоскоп',
      gardenHint: 'Касайся где угодно', gardenMuted: 'Звук выключен в режиме отклика — остались круги',
      thoughtPh: 'Пиши сюда. Это никто не увидит', thoughtGo: 'Отпустить',
      thoughtNote: 'Ничего не сохраняется', thoughtDone: 'Отпущено. Можно выдохнуть',
      stepNext: 'Другой шаг', stepNote: 'Только если хочется',
      st1: 'Дыхание', st2: 'Тело', st3: 'Опора', stagesLabel: 'Этапы практики',
      voiceToggle: 'Голосовые команды',
      vInhale: 'Вдох', vTopup: 'Ещё немного', vExhale: 'Выдох',
      noteA1: 'То, что ты сейчас чувствуешь, — нормальная реакция тела. Подышим вместе',
      noteA2: 'Хорошо. Теперь отпустим напряжение из тела',
      noteA3: 'Хорошо. Теперь вернёмся в комнату, где ты находишься',
      breathHint: 'Не попадаешь в ритм — ничего. Главное — длинный выдох',
      muscleHint: 'Напрягай только до комфортного предела',
      finalSub: 'Если тревога ещё высокая — это нормально. Можно пройти ещё раз',
      again: 'Пройти ещё раз',
    },
  };
  const LANG_ORDER = ['uk', 'en', 'ru'];
  const LANG_CODE = { uk: 'UA', en: 'EN', ru: 'RU' };
  if (!I18N[settings.lang]) settings.lang = 'uk';
  const tr = (key) => (I18N[settings.lang][key] || I18N.uk[key] || key).replace('{m}', settings.sleepMin);

  /* Підставляє вибрану мову в усі статичні елементи та перемикачі мови. */
  function applyLang() {
    document.documentElement.lang = settings.lang;
    document.title = tr('appName');
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = tr(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', tr(el.dataset.i18nAria)); });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = tr(el.dataset.i18nPh); });
    const code = LANG_CODE[settings.lang];
    document.querySelectorAll('.lang-btn').forEach((b) => {
      b.textContent = code;
      b.setAttribute('aria-label', `${tr('langLabel')}: ${code}`);
    });
    document.querySelectorAll('#set-lang button').forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset.value === settings.lang));
    });
    updateVoiceHint();
  }
  /* Одна кнопка мови: кожне натискання — наступна мова за пріоритетом. */
  function nextLang() {
    setLang(LANG_ORDER[(LANG_ORDER.indexOf(settings.lang) + 1) % LANG_ORDER.length]);
  }
  function setLang(lang) {
    if (!I18N[lang]) return;
    settings.lang = lang;
    Store.set('lang', lang);
    applyLang();
  }

  /* ================= 2. Таймеры с отменой =================
     Каждый запущенный сценарий получает «токен». При выходе или пропуске
     токен отменяется: все его таймеры сбрасываются, а ожидающие await
     просто никогда не продолжаются. */
  let token = null;
  function newToken() {
    cancelToken();
    token = { cancelled: false, timers: new Set() };
    return token;
  }
  function cancelToken() {
    if (!token) return;
    token.cancelled = true;
    token.timers.forEach(clearTimeout);
    token.timers.clear();
    token = null;
  }
  function wait(ms, t) {
    return new Promise((resolve) => {
      const id = setTimeout(() => {
        t.timers.delete(id);
        if (!t.cancelled) resolve();
      }, ms);
      t.timers.add(id);
    });
  }

  /* ================= 3. Аудио (Web Audio API) ================= */
  const Sound = {
    ctx: null,
    noiseGain: null,
    noiseSrc: null,
    noiseStopTimer: null,
    live: new Set(), // короткие сигналы, которые можно оборвать при выходе

    /* Создаётся и «размораживается» только из обработчика жеста пользователя. */
    unlock() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        if (!this.ctx) this.ctx = new AC();
        if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
      } catch (e) { this.ctx = null; }
    },
    resume() {
      if (this.ctx && this.ctx.state !== 'running' && this.ctx.state !== 'closed') {
        this.ctx.resume().catch(() => {});
      }
    },
    get ready() { return !!this.ctx; },

    /* Шини гучності з Налаштувань: noise — шум сну, rain — дощ (сон, «Побути
       поруч», «Бульбашки»), fx — усе інше. Голос іде повз них. Обмежувач на
       виході не дає звуку хрипіти на «Гучніше». */
    buses: {},
    _out(name) {
      const c = this.ctx;
      if (!this.buses[name]) {
        if (!this._limiter) {
          const l = c.createDynamicsCompressor();
          l.threshold.value = -3; l.knee.value = 3; l.ratio.value = 12;
          l.attack.value = 0.003; l.release.value = 0.25;
          l.connect(c.destination);
          this._limiter = l;
        }
        const g = c.createGain();
        g.gain.value = VOL_GAIN[settings.vol[name]] || 1;
        g.connect(this._limiter);
        this.buses[name] = g;
      }
      return this.buses[name];
    },
    setVolume(name, level) {
      const g = this.buses[name];
      if (g) g.gain.setTargetAtTime(VOL_GAIN[level] || 1, this.ctx.currentTime, 0.15);
    },

    _track(node, gain) {
      const entry = { node, gain };
      this.live.add(entry);
      node.onended = () => this.live.delete(entry);
    },

    /* Глухой короткий «тук» — замена вибрации там, где её нет (iOS). */
    thud(delay = 0, level = 0.5) {
      if (!this.ready) return;
      const c = this.ctx, t0 = c.currentTime + delay;
      const osc = c.createOscillator(), g = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(82, t0);
      osc.frequency.exponentialRampToValueAtTime(42, t0 + 0.11);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(level, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
      osc.connect(g).connect(this._out('fx'));
      osc.start(t0); osc.stop(t0 + 0.16);
      this._track(osc, g);
    },

    /* Мягкий тон со скольжением частоты — звуковой «проводник» дыхания. */
    glide(f0, f1, dur, level = 0.07) {
      if (!this.ready) return;
      const c = this.ctx, t0 = c.currentTime;
      const osc = c.createOscillator(), g = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f0, t0);
      osc.frequency.linearRampToValueAtTime(f1, t0 + dur);
      const edge = Math.min(0.35, dur / 3);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(level, t0 + edge);
      g.gain.setValueAtTime(level, t0 + dur - edge);
      g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(this._out('fx'));
      osc.start(t0); osc.stop(t0 + dur + 0.05);
      this._track(osc, g);
    },

    /* М'який «дзвіночок» для Звукового саду: синус з тихим обертоном,
       швидка атака й довге згасання. */
    bell(freq, level = 0.13) {
      if (!this.ready) return;
      const c = this.ctx, t0 = c.currentTime, g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(level, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.8);
      g.connect(this._out('fx'));
      [[1, 1], [2, 0.22]].forEach(([mult, part]) => {
        const osc = c.createOscillator(), pg = c.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq * mult;
        pg.gain.value = part;
        osc.connect(pg).connect(g);
        osc.start(t0); osc.stop(t0 + 2.9);
        this._track(osc, g);
      });
    },

    /* ---- Фонові звуки сцен «Бульбашок»: дощ, краплі на склі, хвилі ----
       Усе синтезується з білого шуму фільтрами: дощ — яскравіше шипіння,
       скло — приглушений шум «за вікном», хвилі — низький шум, гучність
       якого повільно накочує й відступає (LFO ~0.1 Гц). */
    ambient: null,
    startAmbient(kind, fadeIn = 3) {
      this.stopAmbient(2);
      if (!this.ready) return;
      if (kind === 'chimes') {
        // Весняні дзвіночки на вітрі: рідкі тихі ноти пентатоніки у
        // випадкові моменти, іноді — дві поспіль
        const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];
        const amb = { timer: null };
        const ring = () => {
          if (this.ambient !== amb) return;
          const pick = () => notes[Math.floor(Math.random() * notes.length)];
          this.bell(pick(), 0.03 + Math.random() * 0.025);
          if (Math.random() < 0.3) setTimeout(() => { if (this.ambient === amb) this.bell(pick(), 0.025); }, 180);
          amb.timer = setTimeout(ring, 600 + Math.random() * 2400);
        };
        this.ambient = amb;
        amb.timer = setTimeout(ring, 500);
        return;
      }
      const c = this.ctx, now = c.currentTime;
      const src = c.createBufferSource();
      src.buffer = this._whiteBuf();
      src.loop = true;
      const hp = c.createBiquadFilter(), lp = c.createBiquadFilter();
      hp.type = 'highpass'; lp.type = 'lowpass';
      const level = c.createGain(), master = c.createGain();
      const preset = {
        rain: { hp: 900, lp: 6500, level: 0.045 },
        glass: { hp: 250, lp: 1700, level: 0.05 },
        waves: { hp: 60, lp: 650, level: 0.11 },
        fire: { hp: 50, lp: 300, level: 0.045 }, // тихий низький гул — лише тло для тріску
      }[kind];
      hp.frequency.value = preset.hp; lp.frequency.value = preset.lp;
      level.gain.value = preset.level;
      master.gain.setValueAtTime(0.0001, now);
      master.gain.linearRampToValueAtTime(1, now + fadeIn);
      src.connect(hp).connect(lp).connect(level).connect(master).connect(this._out(kind === 'rain' || kind === 'glass' ? 'rain' : 'fx'));
      let lfo = null;
      if (kind === 'waves') {
        lfo = c.createOscillator();
        const depth = c.createGain();
        lfo.frequency.value = 0.1;
        depth.gain.value = preset.level * 0.7;
        lfo.connect(depth).connect(level.gain);
        lfo.start();
      }
      src.start();
      const amb = { src, master, lfo, timer: null };
      this.ambient = amb;
      if (kind === 'fire') {
        /* Вогнище впізнається за тріском, а не за гулом, тому головне тут —
           три види звуків поверх тихого тла:
           • «трісь» — дуже короткий різкий сплеск у високих частотах;
           • серія з 3–7 таких сплесків поспіль (займається гілочка);
           • «пук» — рідший, нижчий і гучніший лускіт поліна.
           Тло ще й нерівно «дихає», як полум'я на протязі. */
        const snap = (delay, freq, peak, len, q) => {
          const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
          const t0 = c.currentTime + delay;
          s.buffer = this._white;
          f.type = 'bandpass';
          f.frequency.value = freq;
          f.Q.value = q;
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.exponentialRampToValueAtTime(peak, t0 + 0.002);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
          s.connect(f).connect(g).connect(master);
          s.start(t0, Math.random() * 2.5, len + 0.05);
        };
        const crackle = () => {
          if (this.ambient !== amb) return;
          const roll = Math.random();
          if (roll < 0.14) {
            // лускіт поліна: низький «пук» і одразу дрібний тріск за ним
            snap(0, 500 + Math.random() * 500, 0.32 + Math.random() * 0.14, 0.07, 1.2);
            snap(0.03, 2600 + Math.random() * 2000, 0.16, 0.03, 2.5);
          } else if (roll < 0.42) {
            // серія: гілочка займається
            const n = 3 + Math.floor(Math.random() * 5);
            let at = 0;
            for (let i = 0; i < n; i++) {
              snap(at, 2200 + Math.random() * 3800, 0.08 + Math.random() * 0.16, 0.012 + Math.random() * 0.025, 3);
              at += 0.025 + Math.random() * 0.09;
            }
          } else {
            snap(0, 1800 + Math.random() * 4200, 0.07 + Math.random() * 0.2, 0.012 + Math.random() * 0.04, 3);
          }
          // нерівне «дихання» тла
          const now2 = c.currentTime;
          level.gain.setTargetAtTime(preset.level * (0.6 + Math.random() * 0.9), now2, 0.4);
          amb.timer = setTimeout(crackle, 60 + Math.random() * (Math.random() < 0.25 ? 1300 : 380));
        };
        amb.timer = setTimeout(crackle, 600);
      }
    },
    stopAmbient(fadeOut = 1.5) {
      if (!this.ambient) return;
      const { src, master, lfo, timer } = this.ambient;
      this.ambient = null;
      clearTimeout(timer);
      if (!src) return; // дзвіночки: лише таймер, згасають самі
      const now = this.ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0.0001, now + fadeOut);
      try { src.stop(now + fadeOut + 0.1); if (lfo) lfo.stop(now + fadeOut + 0.1); } catch (e) { /* noop */ }
    },

    /* Білий шум (3 с), спільний для фонових сцен і коротких шелестів. */
    _whiteBuf() {
      if (!this._white) {
        const c = this.ctx;
        this._white = c.createBuffer(1, c.sampleRate * 3, c.sampleRate);
        const d = this._white.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      return this._white;
    },

    /* Шелест повітря через смуговий фільтр: частота ковзає f0 → f1,
       гучність наростає за rise і згасає за fall секунд. */
    _whoosh(delay, f0, f1, q, peak, rise, fall) {
      const c = this.ctx, t0 = c.currentTime + delay, dur = rise + fall;
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this._whiteBuf();
      f.type = 'bandpass'; f.Q.value = q;
      f.frequency.setValueAtTime(f0, t0);
      f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + rise);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      s.connect(f).connect(g).connect(this._out('fx'));
      s.start(t0, Math.random() * 2, dur + 0.05);
      this._track(s, g);
    },

    /* «Відпустити думку»: м'який видих-розсіювання (шелест, що тане й
       опускається) і кілька тихих світлих дзвіночків униз — полегшення. */
    dissolve() {
      if (!this.ready) return;
      this._whoosh(0, 2400, 500, 0.7, 0.11, 0.6, 4.2);
      [[0.5, 1046.5], [1.1, 783.99], [1.8, 659.25], [2.7, 523.25]]
        .forEach(([at, f]) => setTimeout(() => this.bell(f, 0.035), at * 1000));
    },

    /* «Про те, про се»: легенький пташиний «чірік» — два короткі
       висхідні посвисти. */
    chirp() {
      if (!this.ready) return;
      const c = this.ctx;
      [[0, 2900, 4100, 0.07], [0.12, 3200, 4600, 0.06]].forEach(([d, f0, f1, len]) => {
        const t0 = c.currentTime + d, osc = c.createOscillator(), g = c.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f0, t0);
        osc.frequency.exponentialRampToValueAtTime(f1, t0 + len);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.045, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
        osc.connect(g).connect(this._out('fx'));
        osc.start(t0); osc.stop(t0 + len + 0.02);
        this._track(osc, g);
      });
    },

    /* «Маленький крок»: тепла м'яка «калімба» — дві тихі ноти вгору
       з пентатоніки, з повільним згасанням (~2,5 с). Шелест шуму на
       динаміках телефона звучав різко, тому від нього відмовились.
       Ноти щоразу трохи інші, щоб звук не набридав. */
    _stepPairs: [[392, 523.25], [349.23, 440], [440, 587.33], [329.63, 440], [392, 493.88]],
    _stepLast: -1,
    softStep() {
      if (!this.ready) return;
      let i;
      do { i = Math.floor(Math.random() * this._stepPairs.length); } while (i === this._stepLast);
      this._stepLast = i;
      this._pluck(0, this._stepPairs[i][0], 0.06);
      this._pluck(0.28, this._stepPairs[i][1], 0.045);
    },
    /* М'який щипок: синус + ледь чутний обертон, повільна атака (без
       «клацання») і довге згасання. */
    _pluck(delay, freq, level) {
      const c = this.ctx, t0 = c.currentTime + delay, g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(level, t0 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.6);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 2200;
      lp.connect(g).connect(this._out('fx'));
      [[1, 1], [3, 0.08]].forEach(([mult, part]) => {
        const osc = c.createOscillator(), pg = c.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq * mult;
        pg.gain.value = part;
        osc.connect(pg).connect(lp);
        osc.start(t0); osc.stop(t0 + 2.7);
        this._track(osc, g);
      });
    },

    /* «Малювання світлом»: чарівний шлейф — тихі скляні іскорки
       пентатоніки, лише поки палець рухається. Висота залежить від
       висоти точки на полотні (вище — тонше). */
    _sparkAt: 0,
    sparkle(height01) {
      if (!this.ready) return;
      const now = performance.now();
      if (now - this._sparkAt < 110 + Math.random() * 90) return;
      this._sparkAt = now;
      const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5, 1567.98];
      const base = Math.round(height01 * (notes.length - 3));
      const f = notes[Math.min(notes.length - 1, base + Math.floor(Math.random() * 3))];
      const c = this.ctx, t0 = c.currentTime, g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.022 + Math.random() * 0.012, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
      g.connect(this._out('fx'));
      [[1, 1], [2.76, 0.18], [5.4, 0.06]].forEach(([mult, part]) => { // «скляні» обертони
        const osc = c.createOscillator(), pg = c.createGain();
        osc.type = 'sine';
        osc.frequency.value = f * mult;
        pg.gain.value = part;
        osc.connect(pg).connect(g);
        osc.start(t0); osc.stop(t0 + 1.45);
        this._track(osc, g);
      });
    },

    /* Тихий «плюх» бульбашки: короткий синус, що злітає вгору. */
    pop(freq) {
      if (!this.ready) return;
      const c = this.ctx, t0 = c.currentTime;
      const osc = c.createOscillator(), g = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.7, t0 + 0.07);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.11, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);
      osc.connect(g).connect(this._out('fx'));
      osc.start(t0); osc.stop(t0 + 0.13);
      this._track(osc, g);
    },

    stopCues() {
      if (!this.ready) return;
      const now = this.ctx.currentTime;
      this.live.forEach(({ node, gain }) => {
        try {
          gain.gain.cancelScheduledValues(now);
          gain.gain.setTargetAtTime(0.0001, now, 0.03);
          node.stop(now + 0.15);
        } catch (e) { /* уже остановлен */ }
      });
      this.live.clear();
    },

    /* ---- Генератор коричневого шуму ----
       Коричневий шум = інтеграл білого: кожен семпл — попередній плюс
       невеликий випадковий крок («витік» 1.02 не дає сигналу «попливти»).
       Основний спосіб — AudioWorklet: шум народжується наживо, семпл за
       семплом, тож петлі немає взагалі й звук ніде не «провалюється».
       Модуль ворклету вбудовано рядком (Blob), тож працює й офлайн.
       Запасний спосіб для старих браузерів — довгий (30 с) буфер по колу
       з рівнопотужним перехрестям на стику, щоб не було провалу гучності. */
    /* Генератор семплів — один код і для ворклету, і для запасного буфера.
       brown — коричневий шум. rain — злива: м'яке «тіло» з коричневого
       шуму, тихе шипіння білого й рідкі випадкові краплі (короткі сплески,
       що згасають за ~4 мс) — без петлі, тож звук ніколи не повторюється. */
    _GEN_SRC: `function makeGen(kind, rate) {
      let last = 0, env = 0;
      const decay = Math.exp(-1 / (rate * 0.004)), dropP = 26 / rate;
      return function () {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        if (kind !== 'rain') return last * 3.5;
        if (Math.random() < dropP) env = 0.04 + Math.random() * 0.16;
        env *= decay;
        return last * 2.2 + w * 0.2 + (Math.random() * 2 - 1) * env;
      };
    }`,
    _noiseWorklet: null, // Promise<boolean>
    _loadNoiseWorklet() {
      if (this._noiseWorklet) return this._noiseWorklet;
      const c = this.ctx;
      if (!c.audioWorklet || typeof AudioWorkletNode !== 'function') {
        this._noiseWorklet = Promise.resolve(false);
        return this._noiseWorklet;
      }
      const code = `${this._GEN_SRC}
      registerProcessor('anchor-noise', class extends AudioWorkletProcessor {
        constructor(o) { super(); this.gen = makeGen(o.processorOptions.kind, sampleRate); }
        process(inputs, outputs) {
          const out = outputs[0][0];
          for (let i = 0; i < out.length; i++) out[i] = this.gen();
          return true;
        }
      });`;
      const url = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }));
      this._noiseWorklet = c.audioWorklet.addModule(url).then(() => true, () => false);
      return this._noiseWorklet;
    },
    _noiseBuffers: {},
    _makeNoiseBuffer(kind) {
      const c = this.ctx, rate = c.sampleRate;
      const len = rate * 30, fade = Math.floor(rate * 2);
      const raw = new Float32Array(len + fade);
      const gen = new Function(`${this._GEN_SRC}; return makeGen;`)()(kind, rate);
      for (let i = 0; i < raw.length; i++) raw[i] = gen();
      const buffer = c.createBuffer(1, len, rate);
      const data = buffer.getChannelData(0);
      data.set(raw.subarray(0, len));
      for (let i = 0; i < fade; i++) {
        const k = (i / fade) * Math.PI / 2; // рівнопотужне перехрестя
        data[i] = raw[i] * Math.sin(k) + raw[len + i] * Math.cos(k);
      }
      return buffer;
    },

    startNoise(fadeIn = 5, level = 0.32, kind = 'brown') {
      if (!this.ready) return;
      const c = this.ctx;
      clearTimeout(this.noiseStopTimer);
      if (this.noiseGain && this.noiseSrc.kind !== kind) this.stopNoise(0.5);
      if (!this.noiseGain) {
        // шум — глухіший; дощ — світліший, але без різкого верху
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = kind === 'rain' ? 5200 : 900; lp.Q.value = 0.5;
        const g = c.createGain();
        g.gain.value = 0.0001;
        lp.connect(g).connect(this._out(kind === 'rain' ? 'rain' : 'noise'));
        const entry = { node: null, stopped: false, kind };
        this.noiseSrc = entry; this.noiseGain = g;
        this._loadNoiseWorklet().then((ok) => {
          if (entry.stopped) return;
          let node;
          if (ok) {
            try {
              node = new AudioWorkletNode(c, 'anchor-noise', {
                numberOfInputs: 0, outputChannelCount: [1], processorOptions: { kind },
              });
            } catch (e) { node = null; }
          }
          if (!node) {
            if (!this._noiseBuffers[kind]) this._noiseBuffers[kind] = this._makeNoiseBuffer(kind);
            node = c.createBufferSource();
            node.buffer = this._noiseBuffers[kind];
            node.loop = true;
            node.start();
          }
          node.connect(lp);
          entry.node = node;
        });
      }
      const now = c.currentTime, g = this.noiseGain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(Math.max(g.value, 0.0001), now);
      g.linearRampToValueAtTime(level, now + fadeIn); // плавное нарастание
    },

    /* Плавно змінює гучність шуму, що вже грає (без перезапуску). */
    setNoiseLevel(level, ramp = 2) {
      if (!this.noiseGain) return;
      const now = this.ctx.currentTime, g = this.noiseGain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(Math.max(g.value, 0.0001), now);
      g.linearRampToValueAtTime(Math.max(level, 0.0001), now + ramp);
    },

    stopNoise(fadeOut = 1) {
      if (!this.noiseSrc) return;
      const c = this.ctx, entry = this.noiseSrc, gain = this.noiseGain, g = gain.gain, now = c.currentTime;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0.0001, now + fadeOut);
      this.noiseSrc = null; this.noiseGain = null;
      entry.stopped = true;
      // після затухання відключаємо джерело (ворклет не має stop())
      setTimeout(() => {
        try { if (entry.node) { if (entry.node.stop) entry.node.stop(); entry.node.disconnect(); } gain.disconnect(); } catch (e) { /* noop */ }
      }, (fadeOut + 0.2) * 1000);
    },
  };

  /* ---- Записаний голос (MP3) ----
     Необов'язкові файли в папці audio/<мова>/ (перелік — в audio/index.json).
     Якщо для фрази є файл, він звучить замість синтезатора мовлення.
     Програються через той самий AudioContext, тож окремого розблокування
     на iOS не потрібно. Лічильник gen не дає кліпу зазвучати, якщо поки
     він завантажувався, сесію вже зупинили. */
  const Clips = {
    available: new Set(),
    buffers: new Map(),
    current: null,
    gen: 0,
    async init() {
      if (location.protocol === 'file:') return;
      try {
        const res = await fetch('audio/index.json');
        const data = await res.json();
        (data.files || []).forEach((f) => this.available.add(f));
      } catch (e) { /* файлів немає — працює синтезатор */ }
    },
    has(path) { return Sound.ready && this.available.has(path); },
    async _load(path) {
      if (this.buffers.has(path)) return this.buffers.get(path);
      const res = await fetch('audio/' + path);
      const raw = await res.arrayBuffer();
      const buffer = await new Promise((ok, fail) => Sound.ctx.decodeAudioData(raw, ok, fail));
      this.buffers.set(path, buffer);
      return buffer;
    },
    async play(path, volume, onFail) {
      this.stop();
      const gen = this.gen;
      try {
        const buffer = await this._load(path);
        if (gen !== this.gen) return;
        const c = Sound.ctx, src = c.createBufferSource(), g = c.createGain();
        src.buffer = buffer;
        g.gain.value = volume;
        src.connect(g).connect(c.destination);
        src.start();
        this.current = { src, g };
        src.onended = () => { if (this.current && this.current.src === src) this.current = null; };
      } catch (e) {
        this.available.delete(path);
        if (gen === this.gen && onFail) onFail();
      }
    },
    stop() {
      this.gen++;
      if (!this.current) return;
      const { src, g } = this.current, now = Sound.ctx.currentTime;
      this.current = null;
      try { g.gain.setTargetAtTime(0.0001, now, 0.04); src.stop(now + 0.2); } catch (e) { /* noop */ }
    },
  };

  /* ================= 4. Вибро и Wake Lock ================= */
  const Haptic = {
    supported: typeof navigator.vibrate === 'function',

    /* pattern: число (мс) или массив [вибро, пауза, вибро, ...].
       В режиме «Тихий визуал» ничего не делает. Без вибромотора каждый
       импульс заменяется аудио-«туком» (длинные — серией раз в секунду). */
    play(pattern) {
      if (settings.feedback === 'visual') return;
      const list = Array.isArray(pattern) ? pattern : [pattern];
      if (this.supported) {
        try { if (navigator.vibrate(list)) return; } catch (e) { /* fallback ниже */ }
        if (!('ontouchstart' in window)) return; // десктоп: молчим
      }
      // У режимі «Звук + Вібро» довгі вібро-візерунки вже мають звуковий
      // супровід (тон, голос) — щоб не було каші, «тук» лишаємо лише коротким.
      const total = list.reduce((sum, ms) => sum + ms, 0);
      if (settings.feedback === 'sound' && total > 400) return;
      let offset = 0;
      list.forEach((ms, i) => {
        if (i % 2 === 0) {
          for (let t = 0; t < Math.max(ms, 1); t += 1000) Sound.thud((offset + t) / 1000);
        }
        offset += ms;
      });
    },
    stop() {
      if (this.supported) { try { navigator.vibrate(0); } catch (e) { /* noop */ } }
      Sound.stopCues();
    },
  };

  /* Screen Wake Lock: держим экран включённым во время сессий.
     Система сама снимает блокировку при сворачивании — поэтому
     перезапрашиваем её при возврате на вкладку (visibilitychange). */
  const Wake = {
    wanted: false,
    lock: null,
    on() { this.wanted = true; this._request(); },
    async _request() {
      if (!('wakeLock' in navigator) || this.lock || document.visibilityState !== 'visible') return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (!this.wanted) { lock.release().catch(() => {}); return; }
        this.lock = lock;
        lock.addEventListener('release', () => { if (this.lock === lock) this.lock = null; });
      } catch (e) { /* отказ (экономия батареи и т.п.) — работаем без блокировки */ }
    },
    off() {
      this.wanted = false;
      if (this.lock) { this.lock.release().catch(() => {}); this.lock = null; }
    },
  };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (Wake.wanted) Wake._request();
    Sound.resume();
  });

  /* ================= 5. Синтез речи ================= */
  const Speech = {
    synth: 'speechSynthesis' in window ? window.speechSynthesis : null,
    voices: [],
    init() {
      if (!this.synth) return;
      const load = () => { this.voices = this.synth.getVoices() || []; updateVoiceHint(); };
      load();
      // Список голосів приходить із затримкою; якщо за 3 с він так і не
      // з'явився — вважаємо, що голосів немає, і працюємо через імпульси.
      setTimeout(() => { this.settled = true; load(); }, 3000);
      if (typeof this.synth.addEventListener === 'function') this.synth.addEventListener('voiceschanged', load);
      else this.synth.onvoiceschanged = load;
    },
    /* Вибір найм'якшого голосу з наявних на пристрої. Синтезатор не дає
       керувати тембром, тому спокійне звучання досягається трьома речами:
       1) перевага «природним» (Natural / Neural / Enhanced / Premium) голосам —
          мережевим лише за наявності інтернету, інакше вони не зазвучать;
       2) темп, сповільнений на RATE_FACTOR відносно графіка;
       3) трохи знижена висота тону (PITCH). */
    RATE_FACTOR: 0.90,
    PITCH: 0.82,
    voiceFor(lang) {
      const match = this.voices.filter((v) => (v.lang || '').toLowerCase().replace('_', '-').startsWith(lang));
      if (!match.length) return null;
      const score = (v) => {
        const usable = v.localService || navigator.onLine;
        let s = 0;
        if (/natural|neural|enhanced|premium|wavenet/i.test(v.name) && usable) s += 4;
        if (v.localService) s += 2;        // офлайн-голос надійніший у блекаут
        else if (!navigator.onLine) s -= 10; // мережевий без мережі не працює
        return s;
      };
      return match.slice().sort((a, b) => score(b) - score(a))[0];
    },
    /* Доступен ли голос. Пустой список голосов бывает на Android до первой
       фразы — тогда пробуем говорить, полагаясь на utterance.lang. */
    available(lang) {
      if (!this.synth) return false;
      if (this.voices.length === 0) return !this.settled; // після очікування порожній список = голосів немає
      return !!this.voiceFor(lang);
    },
    /* Возвращает false, если произнести нельзя — вызывающий код
       переходит на вибро/визуал. onFail срабатывает при ошибке движка. */
    speak(text, lang, rate, volume, onFail) {
      if (!this.available(lang)) return false;
      try {
        if (this.synth.speaking || this.synth.pending) this.synth.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const voice = this.voiceFor(lang);
        if (voice) u.voice = voice;
        u.lang = voice ? voice.lang.replace('_', '-') : ({ uk: 'uk-UA', en: 'en-US', ru: 'ru-RU' })[lang];
        u.rate = rate * this.RATE_FACTOR * (VOICE_SPEED[settings.voiceSpeed] || 1); u.volume = volume; u.pitch = this.PITCH;
        u.onerror = (e) => {
          if (e.error !== 'interrupted' && e.error !== 'canceled' && onFail) onFail();
        };
        this.synth.speak(u);
        return true;
      } catch (e) { return false; }
    },
    stop() { if (this.synth) { try { this.synth.cancel(); } catch (e) { /* noop */ } } },
  };

  /* Єдина точка для будь-якої фрази: записаний файл, якщо він є, інакше
     синтезатор. Повертає false, якщо сказати нічим (тоді — вібро/візуал). */
  function say(key, text, rate, volume, onFail) {
    const path = `${settings.lang}/${key}.mp3`;
    if (Clips.has(path)) {
      Speech.stop();
      Clips.play(path, volume, onFail);
      return true;
    }
    return Speech.speak(text, settings.lang, rate, volume, onFail);
  }
  function stopVoice() { Speech.stop(); Clips.stop(); }

  /* ================= 6. Поток А: «Сбросить напряжение» ================= */
  const stagesA = [$('a1'), $('a2'), $('a3'), $('a4')];
  const progressA = Array.from($('a-progress').querySelectorAll('button'));
  const soundOn = () => settings.feedback === 'sound';
  const voiceOn = () => soundOn() && settings.voiceCues;

  /* Голосова команда етапу — лише в режимі «Звук + Вібро» й коли
     користувач не вимкнув голос кнопкою в шапці. */
  function cue(key, text) {
    if (voiceOn()) say(key, text, 0.9, 0.85);
  }
  function paintVoiceButton() {
    const btn = $('a-voice');
    btn.hidden = !soundOn(); // без звуку голос не має сенсу
    btn.setAttribute('aria-pressed', String(settings.voiceCues));
  }

  /* fromLaunch: відкрито одразу при запуску. Браузер не дає звучати й
     вібрувати до першого дотику, тому перша підводка чекає дотику. */
  function startFlowA(fromLaunch) {
    paintVoiceButton();
    showScreen('s-flow-a');
    Wake.on();
    startStageA(0, fromLaunch === true);
  }

  /* Перед кожним етапом — коротка тиха підводка: нормалізує стан людини
     («це нормальна реакція тіла») і дає м'який перехід без різкої зміни
     завдання. Нічого не вимагає: жодних дій, звуків чи вібрації. */
  const STAGE_NOTES = [['noteA1', 4500], ['noteA2', 3000], ['noteA3', 3000], ['noteA4', 3000]];

  let noteSkip = null;
  async function startStageA(index, waitTap = false) {
    const t = newToken();
    Haptic.stop();
    stopVoice();
    for (let i = 0; i < progressA.length; i++) {
      progressA[i].className = i < index ? 'done' : i === index ? 'active' : '';
    }
    $('a-skip').hidden = false;
    $('a-skip').dataset.next = String(index + 1);

    stagesA.forEach((el) => { el.hidden = true; });
    $('a-note-text').textContent = tr(STAGE_NOTES[index][0]);
    $('a-note').hidden = false;
    const tapHint = $('a-note').querySelector('[data-i18n]');
    tapHint.textContent = tr(waitTap ? 'tapToStart' : 'noteTap');
    // Підводку можна пропустити дотиком будь-де — для тих, хто її вже знає
    const tapped = new Promise((go) => { noteSkip = go; });
    await (waitTap ? tapped : Promise.race([wait(STAGE_NOTES[index][1], t), tapped]));
    noteSkip = null;
    if (t.cancelled) return;
    $('a-note').hidden = true;

    stagesA[index].hidden = false;
    [runBreathing, runMuscles, runGrounding, runButterfly][index](t);
  }

  /* ---- А4. «Обійми метелика» ----
     Руки схрещені на грудях, долоні на плечах; людина по черзі легенько
     постукує лівою і правою. Почергова (білатеральна) стимуляція в
     повільному ритмі заспокоює й дає відчуття, що тебе тримають.
     Телефон лише задає ритм: два кола світяться по черзі, кожен удар —
     м'який імпульс і (у режимі звуку) тихий низький дзвіночок. */
  /* Темп за практикою Butterfly Hug (Л. Артігас, І. Харреро; EMDR): руки
     постукують ПО ЧЕРЗІ, повільно й ритмічно. Автори не задають точного
     метронома («хай руки рухаються вільно»); для заспокоєння заведено
     повільну стимуляцію короткими серіями з паузою на подих. Тут — один
     удар на секунду, три серії по 20 ударів із повільним вдихом-видихом
     між ними. */
  const BUTTERFLY_SETS = 3, BUTTERFLY_TAPS = 20, BUTTERFLY_MS = 1000, BUTTERFLY_REST = 7000;
  async function runButterfly(t) {
    const dots = $('bf').children, text = $('bf-text');
    const clear = () => { dots[0].classList.remove('on'); dots[1].classList.remove('on'); };
    text.textContent = tr('bfText');
    cue('bfText', tr('bfText'));
    await wait(voiceOn() ? 5500 : 3000, t); // час прочитати й покласти руки
    for (let set = 0; set < BUTTERFLY_SETS; set++) {
      text.textContent = tr('bfText');
      for (let i = 0; i < BUTTERFLY_TAPS; i++) {
        const side = i % 2; // 0 — ліва, 1 — права
        dots[side].classList.add('on');
        dots[1 - side].classList.remove('on');
        Haptic.play(30); // ритм «дотиків» — коротким легким поштовхом
        if (soundOn()) Sound.bell(side ? 147 : 131, 0.05);
        await wait(BUTTERFLY_MS, t);
      }
      clear();
      if (set < BUTTERFLY_SETS - 1) {
        text.textContent = tr('bfPause');
        cue('bfPause', tr('bfPause'));
        await wait(BUTTERFLY_REST, t);
      }
    }
    finishFlowA();
  }

  /* ---- А1. Стейт-машина дыхания: физиологический вздох ----
     6 циклов по 10 секунд, три фазы. Каждая фаза задаёт: текст команды,
     масштаб круга (анимируется CSS-переходом на длительность фазы),
     рисунок вибрации и скольжение тона. Вибромотор не умеет менять силу,
     поэтому «нарастание» — удлиняющиеся импульсы, «затухание» — укорачивающиеся
     с растущими паузами. */
  const BREATH_REST = 0.45;
  /* Вібрація — лише один м'який поштовх на початку кожної фази (вдих,
     довдих, видих): безперервне дзижчання радше тривожить, ніж заспокоює. */
  const BREATH_PHASES = [
    { text: 'inhale', voice: 'vInhale', ms: 2500, scale: 0.8, tone: [150, 196], vib: 40 },
    { text: 'topup', voice: 'vTopup', ms: 1000, scale: 1.0, tone: [196, 233], vib: 20 },
    { text: 'exhale', voice: 'vExhale', ms: 6500, scale: BREATH_REST, tone: [220, 110], vib: [30, 140, 30] },
  ];
  const BREATH_CYCLES = 6;

  async function runBreathing(t) {
    const circle = $('breath-circle'), cmd = $('breath-cmd'), count = $('breath-count');
    circle.style.transitionDuration = '0ms';
    circle.style.transform = `scale(${BREATH_REST})`;
    cmd.textContent = tr('ready');
    count.textContent = '';
    await wait(1200, t);

    for (let cycle = 1; cycle <= BREATH_CYCLES; cycle++) {
      count.textContent = `${cycle} / ${BREATH_CYCLES}`;
      for (const phase of BREATH_PHASES) {
        cmd.textContent = tr(phase.text);
        circle.style.transitionDuration = phase.ms + 'ms';
        circle.style.transform = `scale(${phase.scale})`;
        Haptic.play(phase.vib);
        // з голосом тон стає тихішим тлом, без голосу — основним орієнтиром
        if (soundOn()) Sound.glide(phase.tone[0], phase.tone[1], phase.ms / 1000, voiceOn() ? 0.035 : 0.07);
        cue(phase.text, tr(phase.voice));
        await wait(phase.ms, t);
      }
    }
    startStageA(1);
  }

  /* ---- А2. Сброс мышечного зажима: 3 цикла (5 с напряжения + 15 с отдыха) ---- */
  const MUSCLE_CYCLES = [
    ['m1t', 'm1r'], // кулаки й плечі
    ['m2t', 'm2r'], // очі й щелепа
    ['m3t', 'm3r'], // ноги, живіт, спина
  ];

  async function runMuscles(t) {
    const stage = $('a2'), text = $('a2-text'), timer = $('a2-timer'), count = $('a2-count');
    for (let i = 0; i < MUSCLE_CYCLES.length; i++) {
      const [tense, release] = MUSCLE_CYCLES[i];
      count.textContent = `${i + 1} / ${MUSCLE_CYCLES.length}`;

      stage.classList.add('tense');
      text.textContent = tr(tense);
      cue(tense, tr(tense));
      Haptic.play(40); // один м'який поштовх на початку напруження
      if (soundOn()) Sound.glide(130, 175, 5, 0.05);
      for (let s = 5; s >= 1; s--) { timer.textContent = s; await wait(1000, t); }

      stage.classList.remove('tense');
      text.textContent = tr(release);
      cue(release, tr(release));
      Haptic.play([25, 140, 25]);
      if (soundOn()) Sound.glide(175, 98, 1.6, 0.06);
      for (let s = 15; s >= 1; s--) { timer.textContent = s; await wait(1000, t); }
    }
    startStageA(2);
  }

  /* ---- А3. Заземление 5–4–3–2–1 в темпе пользователя ---- */
  const GROUNDING = [
    [5, 'g5'], // побачити
    [4, 'g4'], // торкнутися
    [3, 'g3'], // почути
    [2, 'g2'], // видихнути
    [1, 'g1'], // відчути опору
  ];
  const ground = { step: 0, taps: 0, locked: true, token: null };

  function runGrounding(t) {
    ground.token = t;
    ground.step = 0;
    renderGroundStep();
  }
  function renderGroundStep() {
    const [need, text] = GROUNDING[ground.step];
    ground.taps = 0;
    ground.locked = false;
    $('a3-text').textContent = tr(text);
    cue(text, tr(text));
    const dots = $('a3-dots');
    dots.textContent = '';
    for (let i = 0; i < need; i++) dots.appendChild(document.createElement('i'));
  }
  async function onGroundTap() {
    if (ground.locked || !ground.token || ground.token.cancelled) return;
    const t = ground.token, need = GROUNDING[ground.step][0];
    $('a3-dots').children[ground.taps].classList.add('on');
    ground.taps++;
    if (ground.taps < need) { Haptic.play(15); return; }

    // Шаг завершён: м'який відгук, короткая пауза, следующий шаг или финал
    ground.locked = true;
    Haptic.play(35);
    if (soundOn()) Sound.glide(196, 147, 0.5, 0.05);
    await wait(650, t);
    if (ground.step < GROUNDING.length - 1) {
      ground.step++;
      renderGroundStep();
    } else {
      startStageA(3);
    }
  }

  /* ---- Теплі слова ----
     Після практики — одна коротка фраза підтримки, щоразу інша. Без оцінок
     і без роду («ти подбав/подбала»), щоб звучало однаково для всіх. */
  const WARM = {
    uk: ['Це було непросто. Ти молодець', 'Ти дбаєш про себе — це важливо',
      'Ти робиш усе, що можеш. Цього досить', 'Дякую, що не лишаєш себе наодинці з цим',
      'Маленький крок — теж крок', 'Твоє тіло тебе почуло',
      'Зараз трохи легше. І це вже щось', 'Ти маєш право на перепочинок',
      'Ти тут. Ти дихаєш. Це головне', 'Відчувати так — нормально. З тобою все гаразд'],
    en: ['That was not easy. Well done', 'You are taking care of yourself — that matters',
      'You are doing all you can. That is enough', 'Thank you for not leaving yourself alone with this',
      'A small step is still a step', 'Your body heard you',
      'It is a little easier now. And that counts', 'You have the right to rest',
      'You are here. You are breathing. That is what matters', 'Feeling this way is normal. You are okay'],
    ru: ['Это было непросто. Ты молодец', 'Ты заботишься о себе — это важно',
      'Ты делаешь всё, что можешь. Этого достаточно', 'Спасибо, что не оставляешь себя наедине с этим',
      'Маленький шаг — тоже шаг', 'Твоё тело тебя услышало',
      'Сейчас немного легче. И это уже что-то', 'У тебя есть право на передышку',
      'Ты здесь. Ты дышишь. Это главное', 'Чувствовать так — нормально. С тобой всё в порядке'],
  };
  let warmLast = -1;
  function warmWord() {
    const list = WARM[settings.lang] || WARM.uk;
    let i;
    do { i = Math.floor(Math.random() * list.length); } while (i === warmLast);
    warmLast = i;
    return list[i];
  }

  /* Хмаринка з теплою фразою посеред екрана: спливає, через 6 с повільно
     розчиняється сама; дотик будь-де — і вона починає розчинятися одразу. */
  let toastTimer = null;
  const TOAST_MS = 6000, TOAST_FADE_MS = 2400;
  function toast(text) {
    const layer = $('toast-layer'), el = $('toast');
    clearTimeout(toastTimer);
    el.className = 'toast';
    el.textContent = text;
    layer.classList.remove('leaving');
    layer.hidden = false;
    void el.getBoundingClientRect();
    el.classList.add('show');
    toastTimer = setTimeout(dissolveToast, TOAST_MS);
  }
  function dissolveToast() {
    const layer = $('toast-layer'), el = $('toast');
    if (layer.hidden || layer.classList.contains('leaving')) return;
    clearTimeout(toastTimer);
    layer.classList.add('leaving');
    el.classList.add('fade');
    toastTimer = setTimeout(() => { layer.hidden = true; el.className = 'toast'; }, TOAST_FADE_MS);
  }
  /* Тепле слово після заняття — лише якщо людина справді побула в ньому. */
  let practiceStart = 0;
  const markPractice = () => { practiceStart = performance.now(); };
  function praiseIfStayed() {
    if (practiceStart && performance.now() - practiceStart > 20000) toast(warmWord());
    practiceStart = 0;
  }

  /* ---- «Моя опора» ----
     Одна фраза для себе або ім'я близької людини. Живе лише в localStorage
     цього телефона; показується на фіналі практики й у «Побути поруч». */
  const getAnchor = () => Store.get('anchorText', '').trim();
  const quoteAnchor = () => { const a = getAnchor(); return a ? `«${a}»` : ''; };
  let anchorReturn = null;
  function openAnchor(returnTo) {
    anchorReturn = returnTo;
    $('anchor-input').value = getAnchor();
    $('anchor-clear').hidden = !getAnchor();
    showScreen('s-anchor');
  }
  function closeAnchor() {
    $('anchor-input').blur();
    (anchorReturn || leaveToHome)();
  }

  /* ---- Фінал потоку А: тепле слово і м'яке «Як ти зараз?» ----
     Три відповіді без оцінок. Вибір ніде не зберігається — він лише
     підказує наступний крок: повторити, перемкнутися в Детокс чи заснути. */
  const FEEL = {
    tense: { text: 'sugTense', label: 'again', go: () => startFlowA() },
    eased: { text: 'sugEased', label: 'goDetox', go: () => openDetox() },
    sleepy: { text: 'sugSleepy', label: 'toSleep', go: () => { updateVoiceHint(); showScreen('s-b1'); } },
  };
  let feelChoice = null;
  function finishFlowA() {
    stopEverything();
    $('final-warm').textContent = warmWord();
    $('final-anchor').textContent = quoteAnchor();
    $('final-ask').hidden = false;
    $('final-next').hidden = true;
    showScreen('s-a-final');
  }
  function chooseFeel(kind) {
    feelChoice = FEEL[kind];
    $('final-suggest').textContent = tr(feelChoice.text);
    $('final-go').textContent = tr(feelChoice.label);
    $('final-ask').hidden = true;
    $('final-next').hidden = false;
  }

  /* ---- «Побути поруч» ----
     Для моментів, коли немає сил щось робити. Жодних завдань: тепле світло
     повільно «дихає» (цикл 10 с: 4 с вдих, 6 с видих), а телефон ледь
     помітно відгукується на початку вдиху й видиху — повільний ритм,
     під який дихання підлаштовується саме. Частий «пульс» прибрано:
     він радше тривожив, ніж заспокоював. */
  const NEAR_CYCLE = 10000, NEAR_IN = 4000; // збігається з near-breathe у styles.css
  /* Фоновий звук «Побути поруч»: одна кнопка перемикає по колу
     вимкнено → хвилі → дощ → дзвіночки → вогнище. Це свідомий вибір
     людини, тому звук грає незалежно від режиму відгуку. */
  const NEAR_SOUNDS = ['off', 'waves', 'rain', 'chimes', 'fire'];
  const NEAR_SOUND_KEYS = { off: 'nsOff', waves: 'nsWaves', rain: 'nsRain', chimes: 'nsChimes', fire: 'nsFire' };
  let nearSound = Store.get('nearSound', 'off');
  if (!NEAR_SOUNDS.includes(nearSound)) nearSound = 'off';
  function applyNearSound() {
    const btn = $('near-sound');
    btn.textContent = tr(NEAR_SOUND_KEYS[nearSound]);
    btn.dataset.on = nearSound === 'off' ? '0' : '1';
    if (nearSound === 'off') Sound.stopAmbient(1.5);
    else Sound.startAmbient(nearSound);
  }
  function nextNearSound() {
    nearSound = NEAR_SOUNDS[(NEAR_SOUNDS.indexOf(nearSound) + 1) % NEAR_SOUNDS.length];
    Store.set('nearSound', nearSound);
    applyNearSound();
  }

  /* Занурення: через 2 с після входу чи дотику зникає хрестик і (через
     повноекранний режим) системний рядок — лишаються світло, фрази й
     перемикач звуку. Дотик будь-де (крім перемикача) повертає їх на 2 с.
     Повноекранний режим просимо лише в межах дії дотику (браузер дозволяє
     це протягом кількох секунд після жесту); де його немає (iPhone) —
     просто ховаємо хрестик. */
  const NEAR_HIDE_MS = 2000;
  let nearHideTimer = null;
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  function enterFullscreen() {
    const d = document.documentElement, req = d.requestFullscreen || d.webkitRequestFullscreen;
    if (fsEl() || !req) return;
    try { const p = req.call(d, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => {}); } catch (e) { /* noop */ }
  }
  function exitFullscreen() {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (!fsEl() || !exit) return;
    try { const p = exit.call(document); if (p && p.catch) p.catch(() => {}); } catch (e) { /* noop */ }
  }
  function nearHideControls() {
    if ($('s-near').hidden) return;
    $('s-near').classList.add('immersive');
    enterFullscreen();
  }
  function nearShowControls() {
    $('s-near').classList.remove('immersive');
    exitFullscreen();
    clearTimeout(nearHideTimer);
    nearHideTimer = setTimeout(nearHideControls, NEAR_HIDE_MS);
  }
  function nearLeave() {
    clearTimeout(nearHideTimer);
    $('s-near').classList.remove('immersive');
    exitFullscreen();
  }

  async function startNear() {
    const t = newToken();
    $('near-anchor').textContent = quoteAnchor();
    showScreen('s-near');
    clearTimeout(nearHideTimer);
    nearHideTimer = setTimeout(nearHideControls, NEAR_HIDE_MS);
    Wake.on();
    applyNearSound();
    markPractice();
    // Перезапускаємо «дихання» світла, щоб поштовхи збігалися з ним
    const glow = document.querySelector('.near-glow');
    glow.style.animation = 'none';
    void glow.getBoundingClientRect();
    glow.style.animation = '';
    for (;;) {
      Haptic.play(25);            // світло починає розгоратися — «вдих»
      await wait(NEAR_IN, t);
      Haptic.play(12);            // ледь відчутно — «видих»
      await wait(NEAR_CYCLE - NEAR_IN, t);
    }
  }

  /* ---- Режим для дитини ----
     Дихання як гра: «надуй кульку» або «понюхай квітку — подуй на свічку».
     Вдих 3 с, видих 4 с (дітям довший ритм важкий). Після п'яти видихів —
     маленьке свято, і гра починається знову. Дорослий поруч дихає разом. */
  const KID_IN = 3000, KID_OUT = 4000, KID_BREATHS = 5;
  const KID_COLORS = ['#C88A55', '#6B8E78', '#B8674A', '#A9835F'];
  const kid = { game: Store.get('kidGame', 'balloon') === 'candle' ? 'candle' : 'balloon', color: 0 };

  function startKid() {
    const t = newToken();
    Haptic.stop();
    stopVoice();
    const balloon = kid.game === 'balloon';
    // у SVG немає властивості .hidden — перемикаємо сам атрибут
    $('kid-balloon').toggleAttribute('hidden', !balloon);
    $('kid-candle').toggleAttribute('hidden', balloon);
    $('kid-game').textContent = tr(balloon ? 'kBalloon' : 'kCandle');
    showScreen('s-kid');
    Wake.on();
    runKid(t);
  }
  async function runKid(t) {
    const stage = $('kid-stage'), text = $('kid-text'), count = $('kid-count');
    const balloon = kid.game === 'balloon';
    const keys = balloon ? ['kInB', 'kOutB', 'kDoneB'] : ['kInC', 'kOutC', 'kDoneC'];
    const setBalloon = (scale, ms) => {
      stage.style.setProperty('--kid-dur', ms + 'ms');
      stage.style.setProperty('--kid-s', scale);
    };
    for (;;) {
      stage.classList.remove('fly', 'blow', 'sniff');
      stage.style.setProperty('--kid-color', KID_COLORS[kid.color++ % KID_COLORS.length]);
      setBalloon(0.35, 0);
      for (let n = 1; n <= KID_BREATHS; n++) {
        count.textContent = `${n} / ${KID_BREATHS}`;
        text.textContent = tr(keys[0]);
        stage.classList.remove('blow');
        stage.classList.add('sniff');
        Haptic.play(35); // лише на зміну дії: «вдих»
        if (soundOn()) Sound.glide(196, 262, KID_IN / 1000, voiceOn() ? 0.035 : 0.06);
        cue(keys[0], tr(keys[0]));
        await wait(KID_IN, t);

        text.textContent = tr(keys[1]);
        stage.classList.remove('sniff');
        stage.classList.add('blow');
        setBalloon(0.35 + (0.65 * n) / KID_BREATHS, KID_OUT); // кулька росте з кожним видихом
        Haptic.play([25, 140, 25]); // «видих»
        if (soundOn()) Sound.glide(262, 165, KID_OUT / 1000, voiceOn() ? 0.035 : 0.06);
        cue(keys[1], tr(keys[1]));
        await wait(KID_OUT, t);
      }
      stage.classList.remove('blow');
      count.textContent = '';
      text.textContent = tr(keys[2]);
      if (balloon) stage.classList.add('fly');
      Haptic.play(30);
      if (soundOn()) { Sound.bell(392, 0.07); setTimeout(() => { if (!t.cancelled) Sound.bell(523.25, 0.07); }, 220); }
      cue(keys[2], tr(keys[2]));
      await wait(3600, t);
    }
  }

  /* ================= 7. Поток Б: «Помочь уснуть» ================= */
  /* Нейтральные существительные для когнитивного перемешивания (по 150 —
     хватает на 15 минут без повторов). */
  const WORDS = {
    ru: ['яблоко', 'фонарь', 'карандаш', 'парус', 'черепаха', 'подушка', 'облако', 'чашка', 'трамвай', 'дерево',
      'ложка', 'окно', 'река', 'книга', 'зонтик', 'лодка', 'корзина', 'мост', 'ёжик', 'тарелка',
      'пуговица', 'ковёр', 'листок', 'озеро', 'тропинка', 'варежка', 'чайник', 'скамейка', 'ромашка', 'улитка',
      'камешек', 'перо', 'одеяло', 'груша', 'колодец', 'мельница', 'бабочка', 'клубок', 'полка', 'морковь',
      'ракушка', 'дождик', 'сад', 'калитка', 'кувшин', 'снежинка', 'тыква', 'шарф', 'велосипед', 'лестница',
      'зеркало', 'платок', 'орех', 'пчела', 'луг', 'блокнот', 'кресло', 'вишня', 'маяк', 'носок',
      'тетрадь', 'ива', 'печенье', 'качели', 'лампа', 'мёд', 'жёлудь', 'шляпа', 'ручей', 'гнездо',
      'слива', 'кисточка', 'холм', 'пирог', 'сова', 'занавеска', 'берёза', 'часы', 'мята', 'глобус',
      'лимон', 'песок', 'ёлка', 'скрипка', 'кот', 'гриб', 'радуга', 'мячик', 'подсолнух', 'хлеб',
      'арбуз', 'панда', 'полотенце', 'свёкла', 'капуста', 'дельфин', 'жираф', 'кенгуру', 'пингвин', 'ласточка',
      'воробей', 'одуванчик', 'тюльпан', 'ландыш', 'сирень', 'каштан', 'клён', 'дуб', 'рябина', 'ежевика',
      'клубника', 'малина', 'персик', 'абрикос', 'виноград', 'апельсин', 'банан', 'сыр', 'блин', 'каша',
      'какао', 'пирожное', 'конфета', 'свитер', 'тапочки', 'пижама', 'расчёска', 'кролик', 'белка', 'лисичка',
      'утка', 'аист', 'светлячок', 'божья коровка', 'муравей', 'бегемот', 'слон', 'зебра', 'воздушный змей', 'остров',
      'волна', 'звезда', 'луна', 'снеговик', 'санки', 'коньки', 'гитара', 'пианино', 'дудочка', 'акварель'],
    uk: ['яблуко', 'ліхтар', 'олівець', 'вітрило', 'черепаха', 'подушка', 'хмара', 'чашка', 'трамвай', 'дерево',
      'ложка', 'вікно', 'річка', 'книга', 'парасолька', 'човен', 'кошик', 'міст', 'їжачок', 'тарілка',
      'ґудзик', 'килим', 'листок', 'озеро', 'стежка', 'рукавичка', 'чайник', 'лавка', 'ромашка', 'равлик',
      'камінець', 'пір’їна', 'ковдра', 'груша', 'криниця', 'млин', 'метелик', 'клубок', 'полиця', 'морква',
      'мушля', 'дощик', 'сад', 'хвіртка', 'глечик', 'сніжинка', 'гарбуз', 'шарф', 'велосипед', 'драбина',
      'дзеркало', 'хустка', 'горіх', 'бджола', 'лука', 'блокнот', 'крісло', 'вишня', 'маяк', 'шкарпетка',
      'зошит', 'верба', 'печиво', 'гойдалка', 'лампа', 'мед', 'жолудь', 'капелюх', 'струмок', 'гніздо',
      'слива', 'пензлик', 'пагорб', 'пиріг', 'сова', 'фіранка', 'береза', 'годинник', 'м’ята', 'глобус',
      'лимон', 'пісок', 'ялинка', 'скрипка', 'кіт', 'гриб', 'веселка', 'м’ячик', 'соняшник', 'хліб',
      'кавун', 'панда', 'рушник', 'буряк', 'капуста', 'дельфін', 'жираф', 'кенгуру', 'пінгвін', 'ластівка',
      'горобець', 'кульбаба', 'тюльпан', 'конвалія', 'бузок', 'каштан', 'клен', 'дуб', 'горобина', 'ожина',
      'полуниця', 'малина', 'персик', 'абрикос', 'виноград', 'апельсин', 'банан', 'сир', 'млинець', 'каша',
      'какао', 'тістечко', 'цукерка', 'светр', 'капці', 'піжама', 'гребінець', 'кролик', 'білка', 'лисичка',
      'качка', 'лелека', 'світлячок', 'сонечко', 'мурашка', 'бегемот', 'слон', 'зебра', 'повітряний змій', 'острів',
      'хвиля', 'зірка', 'місяць', 'сніговик', 'санчата', 'ковзани', 'гітара', 'піаніно', 'сопілка', 'акварель'],
    en: ['apple', 'lantern', 'pencil', 'sail', 'turtle', 'pillow', 'cloud', 'cup', 'tram', 'tree',
      'spoon', 'window', 'river', 'book', 'umbrella', 'boat', 'basket', 'bridge', 'hedgehog', 'plate',
      'button', 'carpet', 'leaf', 'lake', 'path', 'mitten', 'kettle', 'bench', 'daisy', 'snail',
      'pebble', 'feather', 'blanket', 'pear', 'well', 'windmill', 'butterfly', 'yarn', 'shelf', 'carrot',
      'seashell', 'drizzle', 'garden', 'gate', 'jug', 'snowflake', 'pumpkin', 'scarf', 'bicycle', 'ladder',
      'mirror', 'handkerchief', 'walnut', 'bee', 'meadow', 'notebook', 'armchair', 'cherry', 'lighthouse', 'sock',
      'sketchbook', 'willow', 'cookie', 'swing', 'lamp', 'honey', 'acorn', 'hat', 'stream', 'nest',
      'plum', 'paintbrush', 'hill', 'pie', 'owl', 'curtain', 'birch', 'clock', 'mint', 'globe',
      'lemon', 'sand', 'pine', 'violin', 'cat', 'mushroom', 'rainbow', 'ball', 'sunflower', 'bread',
      'watermelon', 'panda', 'towel', 'beetroot', 'cabbage', 'dolphin', 'giraffe', 'kangaroo', 'penguin', 'swallow',
      'sparrow', 'dandelion', 'tulip', 'lily of the valley', 'lilac', 'chestnut', 'maple', 'oak', 'rowan', 'blackberry',
      'strawberry', 'raspberry', 'peach', 'apricot', 'grapes', 'orange', 'banana', 'cheese', 'pancake', 'porridge',
      'cocoa', 'cupcake', 'candy', 'sweater', 'slippers', 'pajamas', 'comb', 'rabbit', 'squirrel', 'fox',
      'duck', 'stork', 'firefly', 'ladybug', 'ant', 'hippo', 'elephant', 'zebra', 'kite', 'island',
      'wave', 'star', 'moon', 'snowman', 'sled', 'skates', 'guitar', 'piano', 'flute', 'watercolor'],
  };

  const SPEECH_BASE_VOLUME = 0.9;
  /* Гучність шуму на початку (далі стишується разом із голосом). Динаміки
     телефона майже не відтворюють найнижчі частоти, тому шум зроблено
     гучнішим і трохи світлішим (див. startNoise). */
  const NOISE_LEVEL = { brown: 0.8, rain: 0.55 };
  const sleepText = $('sleep-text');

  /* ---- Прогрессивное замедление: обратный отсчёт ----
     Чем ближе к нулю, тем длиннее пауза, медленнее и тише голос —
     счёт «растворяется» вместе с вниманием.
       100–80: 2.5 с, скорость 0.95, громкость 100%
        79–50: пауза плавно растёт 2.5 → 4.0 с, 0.85, 80%
        49–20: 6.0 с, 0.75, 60%
        19–0 : 8.5 с, 0.70, 40% */
  function countPace(n) {
    if (n >= 80) return { ms: 2500, rate: 0.95, vol: 1.0 };
    if (n >= 50) return { ms: 2500 + ((79 - n) / 29) * 1500, rate: 0.85, vol: 0.8 };
    if (n >= 20) return { ms: 6000, rate: 0.75, vol: 0.6 };
    return { ms: 8500, rate: 0.70, vol: 0.4 };
  }

  /* ---- Прогрессивное замедление: образы ----
     p — доля прошедшего времени (0..1) из 15 минут:
     пауза 4 → 9 с, скорость 0.9 → 0.7, громкость 100% → 35%. */
  function wordPace(p) {
    return { ms: 4000 + p * 5000, rate: 0.9 - p * 0.2, vol: 1 - p * 0.65 };
  }

  /* Один «такт» сна: показать текст и подать сигнал согласно режиму отклика.
     Звук + Вібро і Тільки Вібро → голос; Лише візуал → тільки тьмяний текст. */
  /* У сні вібрації немає взагалі: вона будить. Голос звучить і в режимі
     «Звук + Вібро», і в «Тільки Вібро»; мовчить лише «Лише візуал».
     Шум (якщо ввімкнено) стишується разом із голосом, щоб слова
     весь час лишалися ледь-ледь гучнішими за нього. */
  const sleepVoice = () => settings.feedback !== 'visual';
  function sleepTick(key, text, pace, isWord) {
    sleepText.classList.toggle('is-word', isWord);
    sleepText.textContent = text;
    if (settings.bg !== 'off') Sound.setNoiseLevel(NOISE_LEVEL[settings.bg] * pace.vol, 2);
    if (sleepVoice()) say(key, String(text), pace.rate, pace.vol * SPEECH_BASE_VOLUME);
  }

  function startSleep() {
    const t = newToken();
    showScreen('s-b2');
    sleepText.classList.remove('fade');
    sleepText.textContent = '';
    Wake.on();
    if (settings.bg !== 'off') Sound.startNoise(6, NOISE_LEVEL[settings.bg], settings.bg);
    (settings.sleepMode === 'count' ? runCountdown : runWords)(t);
  }

  /* Тривалість із Налаштувань: паузи між числами розтягуються пропорційно,
     щоб весь відлік тривав 8, 15 або 25 хвилин. */
  const sleepMs = () => Number(settings.sleepMin) * 60 * 1000;
  async function runCountdown(t) {
    let total = 0;
    for (let n = 100; n >= 0; n--) total += countPace(n).ms;
    const stretch = sleepMs() / total;
    for (let n = 100; n >= 0; n--) {
      const pace = countPace(n);
      sleepTick('n-' + n, n, pace, false);
      await wait(pace.ms * stretch, t);
    }
    endSleep(t);
  }

  async function runWords(t) {
    const list = WORDS[settings.lang] || WORDS.uk;
    let bag = [], lastWord = null; // у мішку — індекси слів (за ними ж шукається MP3 w-<індекс>)
    const started = performance.now();
    for (;;) {
      const p = Math.min(1, (performance.now() - started) / sleepMs());
      if (p >= 1) break;
      // «Мешок» без повторов: все слова проходят по разу, затем перемешиваются заново
      if (bag.length === 0) {
        bag = list.map((_, i) => i);
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        if (bag[bag.length - 1] === lastWord) bag.unshift(bag.pop());
      }
      lastWord = bag.pop();
      const pace = wordPace(p);
      sleepTick('w-' + lastWord, list[lastWord], pace, true);
      await wait(pace.ms, t);
    }
    endSleep(t);
  }

  /* Автоотключение: текст гаснет, шум затухает за 10 секунд, затем полная
     тишина и снятие Wake Lock — телефон может погасить экран сам. */
  async function endSleep(t) {
    sleepText.classList.add('fade');
    stopVoice();
    Sound.stopNoise(10);
    await wait(10500, t);
    sleepText.textContent = '';
    Wake.off();
  }

  /* ---- Защита от случайного выхода: удержание 2 секунды ---- */
  const holdRing = $('hold-ring');
  let holdTimer = null;
  function holdStart(e) {
    if (holdTimer) return;
    if (e.clientX || e.clientY) {
      holdRing.style.left = e.clientX + 'px';
      holdRing.style.top = e.clientY + 'px';
    }
    holdRing.classList.remove('active');
    void holdRing.getBoundingClientRect(); // перезапуск CSS-перехода
    holdRing.classList.add('active');
    holdTimer = setTimeout(() => { goHome(); }, 2000);
  }
  function holdCancel() {
    clearTimeout(holdTimer);
    holdTimer = null;
    holdRing.classList.remove('active');
  }

  /* ================= 7a. Детокс =================
     Розділ для затяжного стресу: не «вирівняти пульс», а дати психіці
     відпочити. Чотири заняття без цілей, рахунку й таймерів — тут нічого
     не можна зробити неправильно. */
  const Detox = { act: null, raf: 0 };
  const DETOX_PANES = ['draw', 'bubbles', 'garden', 'thought', 'step'];
  const DETOX_TITLES = { draw: 'dDraw', bubbles: 'dBubbles', garden: 'dGarden', smile: 'dSmile', thought: 'dThought', step: 'dStep' };

  function openDetox() {
    stopEverything();
    showScreen('s-detox');
  }
  function openAct(name) {
    const t = newToken();
    Detox.act = name;
    $('d-title').textContent = tr(DETOX_TITLES[name]);
    const pane = name === 'smile' ? 'step' : name; // «Усмішка» і «Маленький крок» ділять панель карток
    DETOX_PANES.forEach((n) => { $('d-' + n).hidden = n !== pane; });
    showScreen('s-d-act');
    Wake.on();
    markPractice();
    ({
      draw: startDraw, bubbles: startBubbles, garden: startGarden, thought: startThought,
      step: () => startCards('step'), smile: () => startCards('smile'),
    })[name](t);
  }
  function stopDetox() {
    cancelAnimationFrame(Detox.raf);
    Detox.raf = 0;
    Detox.act = null;
  }

  /* Полотно під розмір панелі з урахуванням щільності пікселів. */
  function fitCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: rect.width, h: rect.height };
  }
  const pointIn = (canvas, e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  /* Теплі відтінки без синього: від бурштинового (25°) до шавлієвого (150°). */
  const warmHue = (now) => 87 + 62 * Math.sin(now / 4000);

  /* ---- Малювання світлом ----
     Кожен рух пальця — короткий відрізок із часом народження. Кадр
     перемальовується повністю: відрізок тьмяніє з віком і зникає через
     LIFE мс. У режимі калейдоскопа відрізок повторюється 6 разів навколо
     центру разом із дзеркальною копією. */
  const draw = { segs: [], last: new Map(), view: null, kaleido: Store.get('kaleido', '1') === '1' };
  const DRAW_LIFE = 5200;
  const DRAW_PASSES = [[10, 0.10], [2.6, 0.8]]; // широке світіння + тонка яскрава лінія

  function startDraw() {
    draw.segs = [];
    draw.last.clear();
    draw.view = fitCanvas($('draw-canvas'));
    $('kaleido').setAttribute('aria-pressed', String(draw.kaleido));
    Detox.raf = requestAnimationFrame(drawFrame);
  }
  function drawFrame(now) {
    const { ctx, w, h } = draw.view;
    ctx.clearRect(0, 0, w, h);
    while (draw.segs.length && now - draw.segs[0].t > DRAW_LIFE) draw.segs.shift();
    const cx = w / 2, cy = h / 2, folds = draw.kaleido ? 6 : 1;
    ctx.lineCap = 'round';
    for (const s of draw.segs) {
      const alpha = 1 - (now - s.t) / DRAW_LIFE;
      for (const [width, strength] of DRAW_PASSES) {
        ctx.lineWidth = width;
        ctx.strokeStyle = `hsla(${s.hue}, 45%, 64%, ${alpha * strength})`;
        ctx.beginPath();
        for (let k = 0; k < folds; k++) {
          const a = (k * 2 * Math.PI) / folds, cos = Math.cos(a), sin = Math.sin(a);
          for (const mirror of draw.kaleido ? [1, -1] : [1]) {
            const x0 = (s.x0 - cx) * mirror, y0 = s.y0 - cy, x1 = (s.x1 - cx) * mirror, y1 = s.y1 - cy;
            ctx.moveTo(cx + x0 * cos - y0 * sin, cy + x0 * sin + y0 * cos);
            ctx.lineTo(cx + x1 * cos - y1 * sin, cy + x1 * sin + y1 * cos);
          }
        }
        ctx.stroke();
      }
    }
    Detox.raf = requestAnimationFrame(drawFrame);
  }
  function drawMove(e) {
    const prev = draw.last.get(e.pointerId);
    if (!prev) return;
    const p = pointIn($('draw-canvas'), e);
    if (Math.hypot(p.x - prev.x, p.y - prev.y) < 3) return;
    const now = performance.now();
    draw.segs.push({ x0: prev.x, y0: prev.y, x1: p.x, y1: p.y, t: now, hue: warmHue(now) });
    if (draw.segs.length > 1400) draw.segs.shift();
    draw.last.set(e.pointerId, p);
    if (soundOn()) Sound.sparkle(1 - Math.min(1, Math.max(0, p.y / draw.view.h)));
  }

  /* ---- Звуковий сад ----
     Висота дотику вибирає ноту пентатоніки (вище — тонше): у цій гамі
     будь-які поєднання звучать злагоджено, тож «сфальшивити» неможливо.
     Кожен дотик лишає коло, що повільно розходиться. Звук є лише в режимі
     «Звук + Вібро»; в інших режимах лишаються кола й легка вібрація. */
  const GARDEN_NOTES = [196.0, 220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
  const garden = { ripples: [], lastNote: new Map(), view: null };
  const RIPPLE_LIFE = 2200;

  function startGarden() {
    garden.ripples = [];
    garden.lastNote.clear();
    garden.view = fitCanvas($('garden-canvas'));
    const hint = $('garden-hint');
    hint.textContent = tr(soundOn() ? 'gardenHint' : 'gardenMuted');
    hint.classList.remove('gone');
    Detox.raf = requestAnimationFrame(gardenFrame);
  }
  function gardenTouch(e, isNew) {
    const p = pointIn($('garden-canvas'), e);
    const band = 1 - Math.min(0.999, Math.max(0, p.y / garden.view.h));
    const index = Math.min(GARDEN_NOTES.length - 1, Math.floor(band * GARDEN_NOTES.length));
    if (!isNew && garden.lastNote.get(e.pointerId) === index) return; // при веденні — лише нова нота
    garden.lastNote.set(e.pointerId, index);
    if (soundOn()) Sound.bell(GARDEN_NOTES[index]);
    else Haptic.play(15);
    garden.ripples.push({ x: p.x, y: p.y, t: performance.now(), hue: 25 + index * 13 });
    if (garden.ripples.length > 60) garden.ripples.shift();
    $('garden-hint').classList.add('gone');
  }
  function gardenFrame(now) {
    const { ctx, w, h } = garden.view;
    ctx.clearRect(0, 0, w, h);
    while (garden.ripples.length && now - garden.ripples[0].t > RIPPLE_LIFE) garden.ripples.shift();
    for (const r of garden.ripples) {
      const p = (now - r.t) / RIPPLE_LIFE, fade = 1 - p;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 12 + p * 110, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = `hsla(${r.hue}, 45%, 64%, ${fade * 0.55})`;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(r.x, r.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${r.hue}, 45%, 64%, ${fade * fade * 0.7})`;
      ctx.fill();
    }
    Detox.raf = requestAnimationFrame(gardenFrame);
  }

  /* ---- Бульбашки ----
     Повільні бульбашки пливуть угору й трохи погойдуються. Дотик лопає
     бульбашку з тихим «плюх» і колом; на її місце знизу випливає нова.
     Рахунку немає: лопати можна, а можна просто дивитися. */
  const bubbles = { items: [], pops: [], view: null, lastT: 0 };
  const POP_LIFE = 480;
  const bubbleX = (b) => b.x + Math.sin(b.ph) * 10;

  function spawnBubble(anywhere) {
    const { w, h } = bubbles.view;
    const r = 22 + Math.random() * 26;
    return {
      x: r + 10 + Math.random() * Math.max(1, w - 2 * r - 20),
      y: anywhere ? Math.random() * h : h + r + Math.random() * 80,
      r, vy: 12 + Math.random() * 18, ph: Math.random() * Math.PI * 2, hue: 25 + Math.random() * 125,
    };
  }
  /* ---- Фонові сцени за бульбашками ----
     Три спокійні сцени змінюють одна одну кожні SCENE_MS (або кнопкою
     внизу) з плавним перетіканням: дощ, краплі на склі, хвилі. У режимі
     «Звук + Вібро» кожна має свій тихий звук. Кольори — сіро-зелені,
     без синього. */
  const SCENES = ['rain', 'glass', 'waves'];
  const SCENE_KEYS = { rain: 'scRain', glass: 'scGlass', waves: 'scWaves' };
  const SCENE_MS = 50000, SCENE_FADE = 2500;
  const scene = { i: 0, prev: -1, since: 0, rain: [], glass: [] };

  function newGlassDrop(h, anywhere) {
    return { x: Math.random(), y: anywhere ? Math.random() * h : -10, y0: 0, r: 2 + Math.random() * 3,
      grow: 0.15 + Math.random() * 0.4, limit: 7 + Math.random() * 4, vy: 0 };
  }
  function initScenes() {
    const { h } = bubbles.view;
    scene.rain = Array.from({ length: 70 }, () => ({
      x: Math.random() * 1.15, y: Math.random() * h, len: 14 + Math.random() * 16, v: 260 + Math.random() * 160,
    }));
    scene.glass = Array.from({ length: 30 }, () => newGlassDrop(h, true));
    scene.prev = -1;
    setScene(0, performance.now());
  }
  function setScene(index, now) {
    if (scene.since) scene.prev = scene.i;
    scene.i = index % SCENES.length;
    scene.since = now;
    $('scene-btn').textContent = tr(SCENE_KEYS[SCENES[scene.i]]);
    if (soundOn()) Sound.startAmbient(SCENES[scene.i]);
  }
  function drawScene(name, alpha, dt, now) {
    const { ctx, w, h } = bubbles.view;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    if (name === 'rain') {
      ctx.strokeStyle = 'rgba(150, 172, 160, 0.26)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (const d of scene.rain) {
        d.y += d.v * dt;
        d.x -= (d.v * dt * 0.12) / w;
        if (d.y - d.len > h) { d.y = -Math.random() * 40; d.x = Math.random() * 1.15; }
        ctx.moveTo(d.x * w, d.y);
        ctx.lineTo(d.x * w + d.len * 0.12, d.y - d.len);
      }
      ctx.stroke();
    } else if (name === 'glass') {
      scene.glass.forEach((d, i) => {
        if (d.vy === 0) {
          d.r += d.grow * dt;
          if (d.r > d.limit) { d.vy = 26; d.y0 = d.y; } // крапля набрякла — починає стікати
        } else {
          d.vy = Math.min(110, d.vy + 40 * dt);
          d.y += d.vy * dt;
          ctx.beginPath();
          ctx.moveTo(d.x * w, d.y0);
          ctx.lineTo(d.x * w, d.y);
          ctx.lineWidth = d.r * 0.7;
          ctx.strokeStyle = 'rgba(160, 182, 170, 0.07)';
          ctx.stroke();
          if (d.y > h + 12) { scene.glass[i] = newGlassDrop(h, true); return; }
        }
        ctx.beginPath();
        ctx.arc(d.x * w, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(165, 188, 176, 0.16)';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(190, 206, 196, 0.3)';
        ctx.stroke();
      });
    } else {
      for (let l = 0; l < 4; l++) {
        const base = h * (0.6 + l * 0.095) + Math.sin(now / 4800 + l * 1.3) * 9;
        const amp = 9 + l * 3, wave = 85 + l * 28, speed = now / (2900 - l * 350) * (l % 2 ? -1 : 1);
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w + 12; x += 12) {
          ctx.lineTo(x, base + Math.sin(x / wave + speed) * amp + Math.sin(x / 37 + now / 2100) * 2);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = `hsla(${152 + l * 5}, 26%, 46%, ${0.1 + l * 0.05})`;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function startBubbles() {
    bubbles.view = fitCanvas($('bubbles-canvas'));
    scene.since = 0;
    initScenes();
    const { w, h } = bubbles.view;
    const count = Math.max(8, Math.min(16, Math.round((w * h) / 26000)));
    bubbles.items = Array.from({ length: count }, () => spawnBubble(true));
    bubbles.pops = [];
    bubbles.lastT = 0;
    Detox.raf = requestAnimationFrame(bubblesFrame);
  }
  function bubblesFrame(now) {
    const { ctx, w, h } = bubbles.view;
    const dt = bubbles.lastT ? Math.min(0.05, (now - bubbles.lastT) / 1000) : 0;
    bubbles.lastT = now;
    ctx.clearRect(0, 0, w, h);
    if (now - scene.since > SCENE_MS) setScene(scene.i + 1, now);
    const k = Math.min(1, (now - scene.since) / SCENE_FADE);
    if (scene.prev >= 0 && k < 1) drawScene(SCENES[scene.prev], 1 - k, dt, now);
    drawScene(SCENES[scene.i], scene.prev >= 0 ? k : 1, dt, now);
    bubbles.items.forEach((b, i) => {
      b.y -= b.vy * dt;
      b.ph += dt * 0.8;
      if (b.y < -b.r) { bubbles.items[i] = spawnBubble(false); return; }
      const x = bubbleX(b);
      ctx.beginPath();
      ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${b.hue}, 45%, 64%, 0.07)`;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = `hsla(${b.hue}, 45%, 66%, 0.5)`;
      ctx.stroke();
      ctx.beginPath(); // відблиск
      ctx.arc(x, b.y, b.r * 0.68, Math.PI * 1.1, Math.PI * 1.45);
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.strokeStyle = `hsla(${b.hue}, 50%, 78%, 0.45)`;
      ctx.stroke();
    });
    while (bubbles.pops.length && now - bubbles.pops[0].t > POP_LIFE) bubbles.pops.shift();
    for (const p of bubbles.pops) {
      const k = (now - p.t) / POP_LIFE;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (1 + k * 0.6), 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = `hsla(${p.hue}, 45%, 70%, ${(1 - k) * 0.6})`;
      ctx.stroke();
    }
    Detox.raf = requestAnimationFrame(bubblesFrame);
  }
  function bubbleTap(e) {
    const p = pointIn($('bubbles-canvas'), e);
    for (let i = bubbles.items.length - 1; i >= 0; i--) {
      const b = bubbles.items[i], x = bubbleX(b);
      if (Math.hypot(p.x - x, p.y - b.y) > b.r + 10) continue;
      bubbles.pops.push({ x, y: b.y, r: b.r, hue: b.hue, t: performance.now() });
      bubbles.items[i] = spawnBubble(false);
      if (soundOn()) Sound.pop(720 - b.r * 8); // більша бульбашка — нижчий звук
      else Haptic.play(20);
      return;
    }
  }

  /* ---- Відпустити думку ----
     Текст ніде не зберігається: після натискання він розпливається,
     підіймається й зникає, а поле очищується. */
  let thoughtBusy = false;
  function startThought() {
    thoughtBusy = false;
    $('thought-input').value = '';
    $('thought-input').hidden = false;
    $('thought-go').hidden = false;
    $('thought-ghost').hidden = true;
  }
  async function releaseThought() {
    const input = $('thought-input'), ghost = $('thought-ghost'), go = $('thought-go');
    const text = input.value.trim(), t = token;
    if (thoughtBusy || !t) return;
    if (!text) { input.focus(); return; } // порожньо — м'яко повертаємо до поля
    thoughtBusy = true;
    input.blur();
    input.value = '';
    ghost.className = 'thought-ghost';
    ghost.textContent = text;
    input.hidden = true; go.hidden = true; ghost.hidden = false;
    void ghost.getBoundingClientRect(); // старт CSS-переходу
    ghost.classList.add('gone');
    Haptic.play(25);
    if (soundOn()) Sound.dissolve();
    await wait(7800, t); // розчинення навмисно повільне — щоб встигнути це відчути

    ghost.textContent = tr('thoughtDone');
    ghost.classList.add('done');
    ghost.classList.remove('gone');
    await wait(3800, t);
    startThought();
  }

  /* ---- Маленький крок ----
     Крихітні дії для себе — лише безпечні в приміщенні, без вимог і
     «треба». Картки йдуть без повторів, поки не закінчиться колода. */
  const STEPS = {
    uk: ['Зроби собі теплий чай або просто випий склянку води', 'Потримай руки під теплою водою хвилину',
      'Зроби три спокійні вдихи, дивлячись на щось приємне', 'Потягнися вгору, ніби після сну',
      'Вмийся прохолодною водою', 'Загорнися в плед на п’ять хвилин',
      'Знайди в кімнаті щось зелене й роздивись його', 'Опусти плечі трохи нижче, ніж вони є зараз',
      'Напиши комусь близькому одне коротке слово', 'Поклади одну річ на її місце',
      'Увімкни пісню, під яку хочеться похитати головою', 'Знайди поглядом найдальшу точку в кімнаті',
      'Розімни долоні та пальці', 'З’їж щось маленьке й смачне, повільно',
      'Полий квітку або просто торкнися листка', 'Ляж на спину й відчуй, як підлога тебе тримає',
      'Погладь кота, собаку або щось м’яке', 'Одягни найтепліші шкарпетки',
      'Розправ ковдру на ліжку', 'Увімкни лампу з теплим світлом',
      'Уяви смак своєї улюбленої страви', 'Порахуй п’ять звуків, які чуєш зараз',
      'Повільно поверни голову вліво, потім вправо', 'Обійми себе за плечі й побудь так трохи'],
    en: ['Make yourself some warm tea, or just drink a glass of water', 'Hold your hands under warm water for a minute',
      'Take three calm breaths while looking at something pleasant', 'Stretch upwards, as if you have just woken up',
      'Wash your face with cool water', 'Wrap yourself in a blanket for five minutes',
      'Find something green in the room and look at it closely', 'Let your shoulders drop a little lower than they are now',
      'Send one short word to someone close to you', 'Put one thing back in its place',
      'Play a song that makes you want to nod along', 'Find the farthest point in the room with your eyes',
      'Rub your palms and fingers', 'Eat something small and tasty, slowly',
      'Water a plant, or simply touch a leaf', 'Lie on your back and feel the floor holding you',
      'Stroke a cat, a dog, or something soft', 'Put on your warmest socks',
      'Smooth out the blanket on your bed', 'Switch on a lamp with warm light',
      'Imagine the taste of your favourite dish', 'Count five sounds you can hear right now',
      'Slowly turn your head to the left, then to the right', 'Hug your own shoulders and stay like that for a while'],
    ru: ['Сделай себе тёплый чай или просто выпей стакан воды', 'Подержи руки под тёплой водой минуту',
      'Сделай три спокойных вдоха, глядя на что-то приятное', 'Потянись вверх, как после сна',
      'Умойся прохладной водой', 'Завернись в плед на пять минут',
      'Найди в комнате что-то зелёное и рассмотри его', 'Опусти плечи чуть ниже, чем они сейчас',
      'Напиши кому-то близкому одно короткое слово', 'Положи одну вещь на её место',
      'Включи песню, под которую хочется покачать головой', 'Найди взглядом самую дальнюю точку в комнате',
      'Разомни ладони и пальцы', 'Съешь что-нибудь маленькое и вкусное, медленно',
      'Полей цветок или просто коснись листа', 'Ляг на спину и почувствуй, как пол тебя держит',
      'Погладь кота, собаку или что-то мягкое', 'Надень самые тёплые носки',
      'Расправь одеяло на кровати', 'Включи лампу с тёплым светом',
      'Представь вкус своего любимого блюда', 'Сосчитай пять звуков, которые слышишь сейчас',
      'Медленно поверни голову влево, потом вправо', 'Обними себя за плечи и побудь так немного'],
  };
  /* ---- Усмішка ----
     Добрий, несерйозний гумор: кумедні факти про тварин і безглузді милі
     картинки для уяви. Свідомо без спогадів і ностальгії (у війну вони
     легко ведуть до думок про втрачене), без жартів про людей, без іронії. */
  const SMILES = {
    uk: ['Морські видри сплять, тримаючись за лапки, щоб їх не рознесло течією',
      'Вомбати какають кубиками. Справжніми, з рівними гранями',
      'Пінгвіни дарують одне одному гарні камінці',
      'Щури хихотять, коли їх лоскочуть, — просто дуже тоненько',
      ['Корови мають найкращих подруг і люблять стояти поруч із ними',
        'Наукові дослідження підтверджують, що корови формують стійкі соціальні зв’язки та мають улюблених «друзів» серед стада'],
      'Японські макаки ліплять сніжки виключно заради гри',
      'Ворони вміють кататися із засніженого даху, а потім залазять назад і їдуть знову. Просто заради розваги',
      'Собаки чхають під час гри, щоб показати, що не мають агресії і все відбувається жартома',
      'Дельфіни кличуть одне одного на ім’я — у кожного свій свист',
      'У морської видри є улюблений камінець, який вона носить у кишеньці під лапою',
      'Слони не вміють стрибати.І, схоже, чудово живуть без цього',
      'Квоки виглядають так, ніби весь час усміхаються',
      'Білки забувають, де сховали частину горіхів і жолудів, — і з них виростають дерева. Ці гризуни — одні з найефективніших «садівників» лісу',
      'Коти не відчувають солодкого смаку. Тож торт вони крадуть із принципу',
      'Кіт упав із дивана й зробив вигляд, що так і планував. Беремо приклад',
      'Чайник закипів і сам вимкнувся. Ось хто вміє вчасно зупинитися',
      'Синоптики обіцяли сонце. Сонце нічого не обіцяло',
      'Є книжка «Як усе встигати». Її ще ніхто не встиг дочитати',
      'Шкарпетки зникають у пральній машині по одній, щоб ми не втрачали віру в дива',
      'Холодильник — єдине місце, куди заглядаєш щопівгодини з надією, що там щось змінилося',
      'Кіт щиро вважає, що це він тебе завів',
      'Присядеш на хвилинку на диван — а диван каже: «Залишайся»',
      'Понеділок спитав у п’ятниці: «Чому тебе всі так люблять?» — «Просто приходжу вчасно»',
      'Бджоли вміють розпізнавати людські обличчя',
      'Капібари такі спокійні і дружелюбні, що на них сідають птахи й навіть мавпочки. Через це їх називають «живими стільцями» природи',
      'Пінгвіни ходять веселим танцем (з боку на бік), бо так витрачають менше сил',
      'У кіз прямокутні зіниці',
      'Мед не псується, тож може зберігатися навіть тисячі років',
      'Деякі равлики можуть спати кілька років поспіль',
      'Банан — це ягода, а полуниця — ні',
      'Їжаки муркочуть, коли почуваються спокійно, тепло та безпечно',
      'Кролики підстрибують і крутяться в повітрі, коли почуваються в безпеці і мають чудовий настрій',
      'Корови лягають перед дощем. Або просто втомилися — точно ніхто не знає',
      'Зарядка завжди лежить у тій кімнаті, де тебе немає',
      'Плед важить рівно стільки, щоб не хотілося вставати',
      'Якщо кіт сів на коліна — у тебе офіційна причина нічого не робити',
      'Я: повертаюся через 2 хвилини після виносу сміття\nМій пес: «ТИ ТУТ! Я ДУМАВ, ТЕБЕ ЗАБРАЛИ ПРИБУЛЬЦІ! СЛАВА БОГУ, ТИ ВДОМА!»',
      'Десь у шафі живе пакет із пакетами. У нього все добре',
      'Вазон на підвіконні бачив усе. І мовчить',
      'У кожному домі є шухляда «на всяк випадок». Що в ній — не знає ніхто. Але варто тільки щось звідти викинути, як «всяк випадок» настане рівно через 15 хвилин',
      'Насіння неможливо з’їсти трохи'],
    en: ['Sea otters hold paws while they sleep so they don’t drift apart',
      'Wombats poop in cubes. Real ones, with flat sides',
      'Penguins give each other nice pebbles as presents',
      'Rats giggle when they are tickled — just in a very tiny voice',
      ['Cows have best friends and like to stand next to them',
        'Research confirms that cows form lasting social bonds and have favourite “friends” within the herd'],
      'Japanese macaques make snowballs purely for play',
      'Crows can slide down a snowy roof, then climb back up and go again. Just for fun',
      'Dogs sneeze during play to show they mean no harm and it’s all in fun',
      'Dolphins call each other by name — each one has its own whistle',
      'A sea otter has a favourite pebble and keeps it in a pocket under its arm',
      'Elephants can’t jump.And they seem to manage perfectly well without it',
      'Quokkas look as if they are smiling all the time',
      'Squirrels forget where they hid some of their nuts and acorns — and trees grow from them. These rodents are among the forest’s most effective “gardeners”',
      'Cats can’t taste sweetness. So they steal cake purely on principle',
      'The cat fell off the sofa and acted as if that was the plan. Worth copying',
      'The kettle boiled and switched itself off. Now that is knowing when to stop',
      'The forecasters promised sun. The sun promised nothing',
      'There is a book called “How to Get Everything Done”. Nobody has had time to finish it',
      'Socks vanish in the washing machine one at a time, so we never stop believing in miracles',
      'The fridge is the one place you check every half hour, hoping something has changed',
      'The cat sincerely believes it was the one who adopted you',
      'You sit on the sofa for a minute — and the sofa says: “Stay”',
      'Monday asked Friday: “Why does everyone love you?” — “I just show up on time”',
      'Bees can recognise human faces',
      'Capybaras are so calm and friendly that birds and even little monkeys sit on them. That’s why they are called nature’s “living chairs”',
      'Penguins walk with a cheerful side-to-side waddle because it saves them energy',
      'Goats have rectangular pupils',
      'Honey doesn’t spoil, so it can keep for thousands of years',
      'Some snails can sleep for several years in a row',
      'A banana is a berry, and a strawberry is not',
      'Hedgehogs purr when they feel calm, warm and safe',
      'Rabbits leap and twist in the air when they feel safe and are in a wonderful mood',
      'Cows lie down before rain. Or they are just tired — nobody knows for sure',
      'The charger is always in the room where you are not',
      'A blanket weighs exactly enough to make you not want to get up',
      'If a cat sits on your lap, you have an official reason to do nothing',
      'Me: back two minutes after taking out the rubbish\nMy dog: “YOU’RE HERE! I THOUGHT ALIENS HAD TAKEN YOU! THANK GOODNESS YOU’RE HOME!”',
      'Somewhere in a cupboard lives a bag of bags. It is doing fine',
      'The plant on the windowsill has seen everything. And says nothing',
      'Every home has a “just in case” drawer. Nobody knows what is in it. But throw one thing out, and “just in case” arrives exactly 15 minutes later',
      'It is impossible to eat just a few sunflower seeds'],
    ru: ['Морские выдры спят, держась за лапки, чтобы их не разнесло течением',
      'Вомбаты какают кубиками. Настоящими, с ровными гранями',
      'Пингвины дарят друг другу красивые камешки',
      'Крысы хихикают, когда их щекочут, — просто очень тоненько',
      ['У коров есть лучшие подруги, и они любят стоять рядом с ними',
        'Научные исследования подтверждают, что коровы формируют устойчивые социальные связи и имеют любимых «друзей» в стаде'],
      'Японские макаки лепят снежки исключительно ради игры',
      'Вороны умеют кататься с заснеженной крыши, а потом залезают обратно и едут снова. Просто ради развлечения',
      'Собаки чихают во время игры, чтобы показать, что не злятся и всё происходит в шутку',
      'Дельфины зовут друг друга по имени — у каждого свой свист',
      'У морской выдры есть любимый камешек, который она носит в кармашке под лапой',
      'Слоны не умеют прыгать.И, похоже, прекрасно живут без этого',
      'Квокки выглядят так, будто всё время улыбаются',
      'Белки забывают, где спрятали часть орехов и желудей, — и из них вырастают деревья. Эти грызуны — одни из самых успешных «садовников» леса',
      'Коты не чувствуют сладкого вкуса. Так что торт они крадут из принципа',
      'Кот упал с дивана и сделал вид, что так и планировал. Берём пример',
      'Чайник закипел и сам выключился. Вот кто умеет вовремя остановиться',
      'Синоптики обещали солнце. Солнце ничего не обещало',
      'Есть книга «Как всё успевать». Её ещё никто не успел дочитать',
      'Носки исчезают в стиральной машине по одному, чтобы мы не теряли веру в чудеса',
      'Холодильник — единственное место, куда заглядываешь каждые полчаса с надеждой, что там что-то изменилось',
      'Кот искренне считает, что это он тебя завёл',
      'Присядешь на минутку на диван — а диван говорит: «Оставайся»',
      'Понедельник спросил у пятницы: «Почему тебя все так любят?» — «Просто прихожу вовремя»',
      'Пчёлы умеют узнавать человеческие лица',
      'Капибары такие спокойные и дружелюбные, что на них садятся птицы и даже обезьянки. Поэтому их называют «живыми стульями» природы',
      'Пингвины ходят весёлым танцем (вперевалку), потому что так тратят меньше сил',
      'У коз прямоугольные зрачки',
      'Мёд не портится, поэтому может храниться даже тысячи лет',
      'Некоторые улитки могут спать несколько лет подряд',
      'Банан — это ягода, а клубника — нет',
      'Ежи мурлычут, когда им спокойно, тепло и безопасно',
      'Кролики подпрыгивают и крутятся в воздухе, когда чувствуют себя в безопасности и у них чудесное настроение',
      'Коровы ложатся перед дождём. Или просто устали — точно никто не знает',
      'Зарядка всегда лежит в той комнате, где тебя нет',
      'Плед весит ровно столько, чтобы не хотелось вставать',
      'Если кот сел на колени — у тебя официальная причина ничего не делать',
      'Я: возвращаюсь через 2 минуты после выноса мусора\nМой пёс: «ТЫ ЗДЕСЬ! Я ДУМАЛ, ТЕБЯ ЗАБРАЛИ ПРИШЕЛЬЦЫ! СЛАВА БОГУ, ТЫ ДОМА!»',
      'Где-то в шкафу живёт пакет с пакетами. У него всё хорошо',
      'Цветок на подоконнике видел всё. И молчит',
      'В каждом доме есть ящик «на всякий случай». Что в нём — не знает никто. Но стоит что-то оттуда выбросить, как «всякий случай» наступит ровно через 15 минут',
      'Семечки невозможно съесть немного'],
  };

  /* Малюнки для «Смішинок»: прості векторні сценки просто в коді (без
     файлів і мережі), у приглушеній палітрі застосунку. Показуються
     замість тексту кожною третьою карткою, з коротким підписом. */
  const PICS = {
    capybara: `<svg viewBox="0 0 200 160" role="img">
      <path d="M58 44q5-9 0-18M144 42q5-9 0-18" stroke="#8B9099" stroke-width="2" fill="none" opacity=".45" stroke-linecap="round"/>
      <ellipse cx="82" cy="52" rx="7" ry="6" fill="#7E5E44"/>
      <rect x="66" y="48" width="62" height="64" rx="24" fill="#9A7556"/>
      <rect x="104" y="60" width="40" height="30" rx="14" fill="#A9835F"/>
      <ellipse cx="138" cy="70" rx="3.2" ry="2.2" fill="#3A2C22"/>
      <path d="M100 67q4-4 8 0" stroke="#2A1F18" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path d="M124 82q6 4 12 0" stroke="#3A2C22" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <circle cx="96" cy="38" r="11" fill="#C88A55"/>
      <path d="M96 28q5-7 11-4q-4 6-11 4z" fill="#6B8E78"/>
      <rect x="28" y="94" width="144" height="48" rx="24" fill="#2A3038" stroke="#8B9099" stroke-width="2"/>
      <ellipse cx="100" cy="97" rx="62" ry="5" fill="#4F7468" opacity=".9"/>
      <circle cx="50" cy="88" r="4" fill="none" stroke="#8B9099" stroke-width="1.5" opacity=".6"/>
      <circle cx="156" cy="84" r="3" fill="none" stroke="#8B9099" stroke-width="1.5" opacity=".6"/>
      <rect x="48" y="140" width="12" height="9" rx="3" fill="#8B9099"/><rect x="140" y="140" width="12" height="9" rx="3" fill="#8B9099"/></svg>`,
    owl: `<svg viewBox="0 0 200 160" role="img">
      <path d="M30 138h140" stroke="#7E5E44" stroke-width="6" stroke-linecap="round"/>
      <circle cx="164" cy="30" r="12" fill="#C88A55" opacity=".85"/>
      <path d="M68 54l6-24 16 14zM132 54l-6-24-16 14z" fill="#7A6450"/>
      <ellipse cx="100" cy="88" rx="40" ry="48" fill="#7A6450"/>
      <ellipse cx="100" cy="104" rx="24" ry="28" fill="#D9C7A8" opacity=".8"/>
      <rect x="64" y="60" width="32" height="21" rx="8" fill="#101216" stroke="#8B9099" stroke-width="1.5"/>
      <rect x="104" y="60" width="32" height="21" rx="8" fill="#101216" stroke="#8B9099" stroke-width="1.5"/>
      <path d="M96 67h8" stroke="#8B9099" stroke-width="2"/>
      <path d="M70 66h9M110 66h9" stroke="#3A3F48" stroke-width="2" stroke-linecap="round"/>
      <path d="M100 82l-5 8h10z" fill="#C88A55"/>
      <path d="M88 132v7M94 132v7M106 132v7M112 132v7" stroke="#C88A55" stroke-width="3" stroke-linecap="round"/>
      <text x="142" y="64" fill="#8B9099" font-size="15" font-family="sans-serif" opacity=".75">z</text>
      <text x="153" y="52" fill="#8B9099" font-size="11" font-family="sans-serif" opacity=".6">z</text></svg>`,
    cat: `<svg viewBox="0 0 200 160" role="img">
      <path d="M14 140h172" stroke="#3A3F48" stroke-width="2" stroke-linecap="round"/>
      <ellipse cx="156" cy="142" rx="30" ry="6" fill="#4F7468" opacity=".8"/>
      <path d="M50 92q-22-6-17-32" stroke="#5A5F69" stroke-width="7" fill="none" stroke-linecap="round"/>
      <ellipse cx="82" cy="96" rx="34" ry="21" fill="#5A5F69"/>
      <path d="M58 106h9v18h-9zM72 108h9v16h-9zM92 108h9v16h-9zM105 106h9v18h-9z" fill="#5A5F69"/>
      <g fill="#C88A55"><path d="M56 120h13v14h4v6H56zM70 120h13v14h4v6H70zM90 120h13v14h4v6H90zM103 120h13v14h4v6h-17z"/></g>
      <path d="M103 60l1-20 14 11zM133 60l0-20-14 11z" fill="#5A5F69"/>
      <circle cx="118" cy="72" r="19" fill="#5A5F69"/>
      <circle cx="111" cy="70" r="2.6" fill="#E2E4E9"/><circle cx="125" cy="70" r="2.6" fill="#E2E4E9"/>
      <path d="M105 63l9 3M131 63l-9 3" stroke="#13161B" stroke-width="2" stroke-linecap="round"/>
      <path d="M116 77h4l-2 3z" fill="#C88A55"/>
      <path d="M124 79l12-2M124 82l12 2M112 79l-12-2M112 82l-12 2" stroke="#8B9099" stroke-width="1" stroke-linecap="round" opacity=".7"/></svg>`,
    cloud: `<svg viewBox="0 0 200 160" role="img">
      <circle cx="162" cy="32" r="13" fill="#C88A55" opacity=".85"/>
      <path d="M0 160v-30q40-30 84-8q40-26 116 0v38z" fill="#6B8E78" opacity=".55"/>
      <path d="M0 160v-14q60-22 120-6q40-12 80 2v18z" fill="#4F7468" opacity=".6"/>
      <g fill="#AEB3BB"><circle cx="70" cy="66" r="18"/><circle cx="92" cy="54" r="24"/><circle cx="118" cy="64" r="19"/><rect x="54" y="62" width="82" height="24" rx="12"/></g>
      <path d="M80 66q4-4 8 0M102 66q4-4 8 0" stroke="#13161B" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path d="M89 74q6 5 12 0" stroke="#13161B" stroke-width="2" fill="none" stroke-linecap="round"/>
      <circle cx="76" cy="73" r="4" fill="#C88A55" opacity=".4"/><circle cx="114" cy="73" r="4" fill="#C88A55" opacity=".4"/></svg>`,
    weather: `<svg viewBox="0 0 200 160" role="img">
      <path d="M14 140h172" stroke="#3A3F48" stroke-width="2" stroke-linecap="round"/>
      <path d="M138 44l-12-16M146 44l10-16" stroke="#8B9099" stroke-width="2" stroke-linecap="round"/>
      <rect x="104" y="44" width="80" height="62" rx="10" fill="#2A3038" stroke="#8B9099" stroke-width="2"/>
      <rect x="112" y="52" width="64" height="46" rx="6" fill="#1B2027"/>
      <circle cx="130" cy="67" r="8" fill="#C88A55"/>
      <g fill="#AEB3BB"><circle cx="146" cy="78" r="7"/><circle cx="156" cy="74" r="9"/><circle cx="165" cy="79" r="6"/><rect x="140" y="77" width="30" height="9" rx="4.5"/></g>
      <path d="M148 90v4M156 90v4M164 90v4" stroke="#6B8E78" stroke-width="2" stroke-linecap="round"/>
      <path d="M122 106v32M166 106v32" stroke="#8B9099" stroke-width="3" stroke-linecap="round"/>
      <path d="M82 134q18 2 18-14" stroke="#5A5F69" stroke-width="7" fill="none" stroke-linecap="round"/>
      <ellipse cx="60" cy="112" rx="26" ry="29" fill="#5A5F69"/>
      <path d="M42 68l2-21 15 12zM78 68l-2-21-15 12z" fill="#5A5F69"/>
      <circle cx="60" cy="76" r="20" fill="#5A5F69"/>
      <path d="M47 60l1-8 6 5zM73 60l-1-8-6 5z" fill="#C88A55" opacity=".5"/></svg>`,
    parrot: `<svg viewBox="0 0 200 160" role="img">
      <ellipse cx="156" cy="74" rx="22" ry="30" fill="#1B2027" stroke="#8B9099" stroke-width="2.5"/>
      <path d="M156 104v30M140 136h32" stroke="#8B9099" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M146 76q1-12 10-12q9 0 10 12z" fill="#B8674A" opacity=".55"/>
      <circle cx="156" cy="62" r="3" fill="#D9C7A8" opacity=".55"/>
      <path d="M168 54l5-5M172 62h6" stroke="#C88A55" stroke-width="2" stroke-linecap="round"/>
      <path d="M70 120l-8 30 12-4 4 8 6-34z" fill="#4F7468"/>
      <path d="M26 126h100" stroke="#7E5E44" stroke-width="6" stroke-linecap="round"/>
      <ellipse cx="80" cy="96" rx="24" ry="31" fill="#6B8E78"/>
      <path d="M64 86q-10 22 6 36q8-18-6-36z" fill="#4F7468"/>
      <path d="M74 126v-5M86 126v-5" stroke="#C88A55" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="86" cy="62" r="19" fill="#6B8E78"/>
      <path d="M103 62q13 2 8 15q-8 2-12-6z" fill="#C88A55"/>
      <circle cx="93" cy="65" r="3" fill="#13161B"/><circle cx="94" cy="64" r="1" fill="#E2E4E9"/>
      <path d="M67 52q1-23 20-23q19 0 20 23z" fill="#B8674A"/>
      <path d="M77 34v16M87 30v20M97 34v16" stroke="#13161B" stroke-width="1.5" opacity=".25"/>
      <rect x="63" y="48" width="48" height="9" rx="4.5" fill="#D9C7A8"/>
      <circle cx="87" cy="26" r="6.5" fill="#D9C7A8"/></svg>`,
    goose: `<svg viewBox="0 0 200 160" role="img">
      <path d="M8 140h184" stroke="#3A3F48" stroke-width="2" stroke-linecap="round"/>
      <path d="M124 124v14M138 124v14M120 139h8M134 139h8" stroke="#C88A55" stroke-width="3" stroke-linecap="round"/>
      <path d="M104 100l-14-10 5 18z" fill="#C9CDD4"/>
      <path d="M150 100q12-12 10-44" stroke="#C9CDD4" stroke-width="12" fill="none" stroke-linecap="round"/>
      <ellipse cx="130" cy="106" rx="30" ry="20" fill="#C9CDD4"/>
      <path d="M112 102q18-10 34 2q-16 14-34-2z" fill="#AEB3BB"/>
      <circle cx="161" cy="52" r="10" fill="#C9CDD4"/>
      <path d="M169 48l14 4-14 5z" fill="#C88A55"/>
      <circle cx="164" cy="49" r="2" fill="#13161B"/>
      <path d="M124 100l-6-66" stroke="#8B9099" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M118 34l22 8-21 8z" fill="#6B8E78"/>
      <g fill="#D9C7A8"><circle cx="28" cy="127" r="9"/><circle cx="35" cy="116" r="6"/>
        <circle cx="54" cy="127" r="9"/><circle cx="61" cy="116" r="6"/>
        <circle cx="80" cy="127" r="9"/><circle cx="87" cy="116" r="6"/></g>
      <g fill="#C88A55"><path d="M40 115l6 2-6 2zM66 115l6 2-6 2zM92 115l6 2-6 2z"/></g>
      <g fill="#13161B"><circle cx="37" cy="114" r="1.2"/><circle cx="63" cy="114" r="1.2"/><circle cx="89" cy="114" r="1.2"/></g>
      <path d="M26 136v4M32 136v4M52 136v4M58 136v4M78 136v4M84 136v4" stroke="#C88A55" stroke-width="2" stroke-linecap="round"/></svg>`,
  };
  const PIC_IDS = Object.keys(PICS);
  const PIC_CAPS = {
    uk: { capybara: 'Капібара в теплій ванні з мандаринкою на голові', owl: 'Сова вдень удає, що зовсім не спить',
      cat: 'Кіт у гумових чобітках дуже серйозно обходить калюжу', cloud: 'Хмаринка забула, куди пливла, і просто милується краєвидом',
      weather: 'Кіт уважно слухає прогноз погоди', parrot: 'Папуга приміряє шапку', goose: 'Гусак веде екскурсію двором' },
    en: { capybara: 'A capybara in a warm bath with a tangerine on its head', owl: 'An owl pretending all day that it is not asleep',
      cat: 'A cat in rubber boots very seriously walks around a puddle', cloud: 'A little cloud forgot where it was going and just enjoys the view',
      weather: 'A cat listening closely to the weather forecast', parrot: 'A parrot trying on a hat', goose: 'A goose giving a guided tour of the yard' },
    ru: { capybara: 'Капибара в тёплой ванне с мандаринкой на голове', owl: 'Сова днём делает вид, что совсем не спит',
      cat: 'Кот в резиновых сапожках очень серьёзно обходит лужу', cloud: 'Облачко забыло, куда плыло, и просто любуется видом',
      weather: 'Кот внимательно слушает прогноз погоды', parrot: 'Попугай примеряет шапку', goose: 'Гусь ведёт экскурсию по двору' },
  };

  /* Спільна колода для «Маленького кроку» та «Усмішки». */
  const DECKS = {
    step: { cards: STEPS, next: 'stepNext', note: 'stepNote' },
    smile: { cards: SMILES, next: 'smileNext', note: '', pics: true },
  };
  /* Перемішані індекси 0..n-1; перший, що буде витягнутий, не дорівнює last. */
  function shuffled(n, last) {
    const bag = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    if (n > 1 && bag[n - 1] === last) bag.unshift(bag.pop());
    return bag;
  }
  let deck = DECKS.step, deckKind = 'step', stepBag = [], stepLast = -1, picBag = [], picLast = -1, cardNo = 0;
  function startCards(kind) {
    deck = DECKS[kind];
    deckKind = kind;
    stepBag = []; picBag = [];
    stepLast = -1; picLast = -1; cardNo = 0;
    $('step-next').textContent = tr(deck.next);
    $('step-note').textContent = deck.note ? tr(deck.note) : '';
    nextStep();
  }
  /* Натискання «Ще одну» / «Інший крок»: легкий відгук згідно з режимом —
     у «Про те, про се» тихий пташиний «чірік», у «Маленькому кроці» —
     дві тихі ноти «калімби», плюс ледь відчутна вібрація. */
  function onNextCard() {
    if (soundOn()) (deckKind === 'smile' ? Sound.chirp() : Sound.softStep());
    Haptic.play(15);
    nextStep();
  }
  function nextStep() {
    const list = deck.cards[settings.lang] || deck.cards.uk;
    const text = $('step-text'), pic = $('step-pic'), note = $('step-note');
    cardNo++;
    if (deck.pics && cardNo % 3 === 0) { // кожна третя картка «Смішинок» — малюнок
      if (!picBag.length) picBag = shuffled(PIC_IDS.length, picLast);
      picLast = picBag.pop();
      const id = PIC_IDS[picLast];
      pic.innerHTML = PICS[id];
      pic.hidden = false;
      text.textContent = (PIC_CAPS[settings.lang] || PIC_CAPS.uk)[id];
      note.textContent = '';
    } else {
      if (!stepBag.length) stepBag = shuffled(list.length, stepLast);
      stepLast = stepBag.pop();
      pic.hidden = true;
      pic.textContent = '';
      // картка — це рядок або пара [текст, дрібна примітка під ним]
      const card = list[stepLast];
      text.textContent = Array.isArray(card) ? card[0] : card;
      note.textContent = Array.isArray(card) ? card[1] : (deck.note ? tr(deck.note) : '');
    }
    [pic, text].forEach((el) => {
      el.classList.remove('fade-in');
      void el.getBoundingClientRect(); // перезапуск плавної появи
      el.classList.add('fade-in');
    });
  }

  function bindDetox() {
    $('btn-detox').addEventListener('click', () => { Sound.unlock(); openDetox(); });
    $('detox-exit').addEventListener('click', goHome);
    $('d-exit').addEventListener('click', () => { openDetox(); praiseIfStayed(); });
    $('detox-tiles').querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => { Sound.unlock(); openAct(b.dataset.act); });
    });

    const dc = $('draw-canvas');
    dc.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { dc.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      draw.last.set(e.pointerId, pointIn(dc, e));
    });
    dc.addEventListener('pointermove', drawMove);
    ['pointerup', 'pointercancel'].forEach((ev) => dc.addEventListener(ev, (e) => draw.last.delete(e.pointerId)));
    $('kaleido').addEventListener('click', () => {
      draw.kaleido = !draw.kaleido;
      Store.set('kaleido', draw.kaleido ? '1' : '0');
      $('kaleido').setAttribute('aria-pressed', String(draw.kaleido));
    });

    const gc = $('garden-canvas');
    gc.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { gc.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      gardenTouch(e, true);
    });
    gc.addEventListener('pointermove', (e) => { if (garden.lastNote.has(e.pointerId)) gardenTouch(e, false); });
    ['pointerup', 'pointercancel'].forEach((ev) => gc.addEventListener(ev, (e) => garden.lastNote.delete(e.pointerId)));

    $('bubbles-canvas').addEventListener('pointerdown', (e) => { e.preventDefault(); bubbleTap(e); });
    $('scene-btn').addEventListener('click', () => setScene(scene.i + 1, performance.now()));

    $('thought-go').addEventListener('click', releaseThought);
    $('step-next').addEventListener('click', onNextCard);

    // Поворот екрана або клавіатура змінюють розмір панелі — підганяємо полотно
    window.addEventListener('resize', () => {
      if (Detox.act === 'draw') draw.view = fitCanvas($('draw-canvas'));
      if (Detox.act === 'garden') garden.view = fitCanvas($('garden-canvas'));
      if (Detox.act === 'bubbles') bubbles.view = fitCanvas($('bubbles-canvas'));
    });
  }

  /* ================= 8. Навигация и события ================= */
  const screens = Array.from(document.querySelectorAll('.screen'));
  let currentScreen = '';
  function showScreen(id) {
    currentScreen = id;
    screens.forEach((el) => { el.hidden = el.id !== id; });
    // Один запис в історії на весь час поза головним екраном — щоб системна
    // кнопка «Назад» вела додому (див. обробник popstate в init)
    if (id !== 's-home' && id !== 's-intro' && !(history.state && history.state.inApp)) {
      try { history.pushState({ inApp: true }, ''); } catch (e) { /* noop */ }
    }
  }

  /* Останавливает всё, что может звучать, вибрировать или тикать. */
  function stopEverything() {
    cancelToken();
    holdCancel();
    stopDetox();
    ground.token = null;
    Haptic.stop();
    stopVoice();
    Sound.stopAmbient(0.8);
    Sound.stopNoise(0.8);
    Wake.off();
    nearLeave();
  }
  function leaveToHome() {
    stopEverything();
    showScreen('s-home');
  }
  function goHome() {
    leaveToHome();
    if (history.state && history.state.inApp) {
      try { history.back(); } catch (e) { /* noop */ }
    }
  }

  /* Радиогруппы: выделяют активную кнопку и сохраняют выбор. */
  function bindRadio(group, attr, current, onChange) {
    const buttons = Array.from(group.querySelectorAll('button'));
    const paint = (value) => buttons.forEach((b) => b.setAttribute('aria-checked', String(b.dataset[attr] === value)));
    paint(current);
    buttons.forEach((b) => b.addEventListener('click', () => {
      paint(b.dataset[attr]);
      onChange(b.dataset[attr]);
    }));
  }

  function updateVoiceHint() {
    const hint = $('voice-hint');
    if (!hint) return;
    let text = '';
    if (settings.feedback === 'visual') text = tr('hintVisual');
    else if (!Speech.available(settings.lang)) text = tr('hintNoVoice');
    hint.textContent = text;
    hint.hidden = !text;
  }

  /* ================= 8a. Налаштування ================= */
  // Збільшувати разом із CACHE у sw.js
  const APP_VERSION = 27;
  const ICONS = ['default', 'bright', 'calm'];

  /* Іконку на головному екрані телефона веб-застосунок змінити не може —
     браузер бере її з маніфесту під час встановлення. Тому підміняємо маніфест:
     після повторного додавання на головний екран буде обрана іконка. */
  function applyIcon(name) {
    const v = name === 'default' ? '' : '-' + name;
    $('manifest-link').href = v ? `manifest${v}.json` : 'manifest.json';
    $('favicon-link').href = $('touch-icon-link').href = `icons/icon${v}-192.png`;
  }

  // Нова версія вже стала активною (браузер перевіряє оновлення сам під час запуску)
  let updateReady = false;
  function updStatus(key) {
    const el = $('update-status');
    el.textContent = key ? tr(key) : '';
    el.hidden = !key;
    $('update-apply').hidden = key !== 'updFound';
    $('update-check').hidden = key === 'updFound';
  }
  function openSettings() {
    $('set-version').textContent = `${tr('version')} ${APP_VERSION}`;
    updStatus(updateReady ? 'updFound' : '');
    $('reset-confirm').hidden = true; $('reset-ask').hidden = false;
    // голосові підказки можна вимкнути й кнопкою у вправі — показуємо актуальне
    $('set-cues').querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-checked', String((b.dataset.value === 'on') === settings.voiceCues));
    });
    $('s-settings').querySelector('.settings').scrollTop = 0;
    showScreen('s-settings');
  }
  async function checkUpdate() {
    const btn = $('update-check');
    if (btn.disabled) return;
    if (!('serviceWorker' in navigator)) { updStatus('updNoSupport'); return; }
    if (navigator.onLine === false) { updStatus('updOffline'); return; }
    btn.disabled = true;
    updStatus('updChecking');
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) { updStatus('updNoSupport'); return; }
      await reg.update();
      const worker = reg.installing || reg.waiting;
      if (!worker) { updStatus(updateReady ? 'updFound' : 'updLatest'); return; }
      // Чекаємо, поки нова версія завантажить усі файли
      await new Promise((resolve) => {
        const done = () => { if (['installed', 'activated', 'redundant'].includes(worker.state)) resolve(); };
        worker.addEventListener('statechange', done);
        setTimeout(resolve, 30000);
        done();
      });
      if (worker.state === 'redundant') { updStatus('updOffline'); return; }
      if (reg.waiting) reg.waiting.postMessage('skipWaiting');
      updateReady = true;
      updStatus('updFound');
    } catch (e) {
      updStatus('updOffline');
    } finally {
      btn.disabled = false;
    }
  }

  /* Короткий зразок (3 с) обраного фону з новою гучністю. */
  let previewTimer = null;
  function previewVolume(bus) {
    clearTimeout(previewTimer);
    if (bus === 'fx') { Sound.stopNoise(0.3); Sound.bell(659.25); return; }
    Sound.startNoise(0.4, NOISE_LEVEL[bus === 'rain' ? 'rain' : 'brown'], bus === 'rain' ? 'rain' : 'brown');
    previewTimer = setTimeout(() => Sound.stopNoise(1.2), 3000);
  }

  async function shareApp() {
    const url = new URL('./', location.href).href;
    const data = { title: tr('appName'), text: tr('shareText'), url };
    try {
      if (navigator.share) { await navigator.share(data); return; }
    } catch (e) {
      if (e && e.name === 'AbortError') return; // людина передумала
    }
    try {
      await navigator.clipboard.writeText(`${data.text}\n${url}`);
      toast(tr('shareCopied'));
    } catch (e) { toast(url); }
  }

  /* Видаляє все, що застосунок зберіг на телефоні (налаштування, «Моя опора»),
     і починає з першого екрана. Кеш для роботи без інтернету лишається. */
  function resetAll() {
    try {
      Object.keys(localStorage).filter((k) => k.startsWith('anchor.')).forEach((k) => localStorage.removeItem(k));
    } catch (e) { /* noop */ }
    location.replace(new URL('./', location.href).href);
  }

  function bindSettings() {
    $('btn-settings').addEventListener('click', openSettings);
    $('settings-exit').addEventListener('click', goHome);
    const langGroup = $('set-lang');
    bindRadio(langGroup, 'value', settings.lang, setLang);
    settings.icon = Store.get('icon', 'default');
    if (!ICONS.includes(settings.icon)) settings.icon = 'default';
    bindRadio($('set-icon'), 'value', settings.icon, (v) => {
      settings.icon = v; Store.set('icon', v); applyIcon(v);
    });
    // Розмір тексту
    bindRadio($('set-text'), 'value', settings.textSize, (v) => {
      settings.textSize = v; Store.set('textSize', v);
      document.documentElement.classList.toggle('text-lg', v === 'large');
    });
    // Що відкривати при запуску
    if (!['home', 'calm', 'near'].includes(settings.start)) settings.start = 'home';
    bindRadio($('set-start'), 'value', settings.start, (v) => { settings.start = v; Store.set('start', v); });
    // Голос
    bindRadio($('set-cues'), 'value', settings.voiceCues ? 'on' : 'off', (v) => {
      settings.voiceCues = v === 'on'; Store.set('voiceCues', settings.voiceCues ? '1' : '0');
    });
    bindRadio($('set-speed'), 'value', settings.voiceSpeed, (v) => {
      settings.voiceSpeed = v; Store.set('voiceSpeed', v);
      Sound.unlock(); say('', tr('nearText'), 1, SPEECH_BASE_VOLUME); // одразу чути новий темп
    });
    // Гучність фону: зразок звуку, щоб одразу почути різницю
    [['noise', 'vol-noise', 'volNoise'], ['rain', 'vol-rain', 'volRain'], ['fx', 'vol-fx', 'volFx']].forEach(([bus, id, key]) => {
      if (!VOL_GAIN[settings.vol[bus]]) settings.vol[bus] = 'mid';
      bindRadio($(id), 'value', settings.vol[bus], (v) => {
        settings.vol[bus] = v; Store.set(key, v);
        Sound.unlock(); Sound.setVolume(bus, v);
        previewVolume(bus);
      });
    });
    // Тривалість сну
    bindRadio($('set-sleep'), 'value', settings.sleepMin, (v) => {
      settings.sleepMin = v; Store.set('sleepMin', v); applyLang();
    });
    // Поділитися
    $('btn-share').addEventListener('click', shareApp);
    // Скинути все — лише після підтвердження
    $('reset-ask').addEventListener('click', () => { $('reset-ask').hidden = true; $('reset-confirm').hidden = false; });
    $('reset-no').addEventListener('click', () => { $('reset-confirm').hidden = true; $('reset-ask').hidden = false; });
    $('reset-yes').addEventListener('click', resetAll);
    $('update-check').addEventListener('click', checkUpdate);
    $('update-apply').addEventListener('click', () => location.reload());
    if ('serviceWorker' in navigator) {
      const hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController) return; // перше встановлення — це не оновлення
        updateReady = true;
        if (currentScreen === 's-settings') updStatus('updFound');
      });
    }
  }

  function init() {
    Speech.init();
    Clips.init();

    // Любой первый жест размораживает AudioContext (нужно при каждом запуске)
    document.addEventListener('pointerdown', () => Sound.unlock(), { capture: true });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('s-home').hidden && $('s-intro').hidden) goHome();
    });
    // Довге натискання не відкриває системне меню — окрім поля для тексту,
    // де воно потрібне, щоб вставити чи виділити написане
    document.addEventListener('contextmenu', (e) => {
      if (!(e.target instanceof HTMLTextAreaElement)) e.preventDefault();
    });

    // Кнопка «Назад» телефона повертає на попередній екран, а не закриває застосунок
    window.addEventListener('popstate', () => {
      if (currentScreen === 's-d-act') openDetox();
      else if (currentScreen !== 's-home' && currentScreen !== 's-intro') leaveToHome();
    });

    // Екранна клавіатура: піднімаємо вміст, щоб кнопка під полем не ховалася
    if (window.visualViewport) {
      const vv = window.visualViewport;
      const lift = () => {
        const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
        document.documentElement.style.setProperty('--kb', (kb > 80 ? kb : 0) + 'px');
      };
      vv.addEventListener('resize', lift);
      vv.addEventListener('scroll', lift);
    }

    $('btn-intro').addEventListener('click', () => {
      Sound.unlock();
      Store.set('seen', '1');
      showScreen('s-home');
    });

    $('btn-calm').addEventListener('click', () => { Sound.unlock(); startFlowA(); });
    $('btn-sleep').addEventListener('click', () => { Sound.unlock(); updateVoiceHint(); showScreen('s-b1'); });

    bindRadio($('feedback'), 'mode', settings.feedback, (v) => {
      settings.feedback = v; Store.set('feedback', v);
      Haptic.play(40); // сразу даём почувствовать выбранный отклик
    });

    // Поток А
    $('a-exit').addEventListener('click', goHome);
    // Навігація по етапах: натискання на сегмент прогресу відкриває цей етап
    progressA.forEach((b, i) => b.addEventListener('click', () => startStageA(i)));
    $('a-voice').addEventListener('click', () => {
      settings.voiceCues = !settings.voiceCues;
      Store.set('voiceCues', settings.voiceCues ? '1' : '0');
      if (!settings.voiceCues) stopVoice();
      paintVoiceButton();
    });
    $('s-flow-a').addEventListener('click', (e) => {
      if (noteSkip && !e.target.closest('button')) noteSkip();
    });
    $('a-skip').addEventListener('click', (e) => {
      const next = Number(e.currentTarget.dataset.next);
      if (next < stagesA.length) startStageA(next); else finishFlowA();
    });
    $('a3').addEventListener('click', onGroundTap);
    // Фінал: «Як ти зараз?» → пропозиція наступного кроку
    document.querySelectorAll('#final-ask [data-feel]').forEach((b) => {
      b.addEventListener('click', () => chooseFeel(b.dataset.feel));
    });
    $('final-go').addEventListener('click', () => { Sound.unlock(); if (feelChoice) feelChoice.go(); });
    document.querySelectorAll('.js-home').forEach((b) => b.addEventListener('click', goHome));

    // «Побути поруч»
    $('btn-near').addEventListener('click', () => { Sound.unlock(); startNear(); });
    $('toast-layer').addEventListener('pointerdown', (e) => { e.preventDefault(); dissolveToast(); });
    $('near-exit').addEventListener('click', () => { goHome(); praiseIfStayed(); });
    $('s-near').addEventListener('pointerdown', (e) => {
      if (!e.target.closest('#near-sound')) nearShowControls();
    });
    $('near-sound').addEventListener('click', nextNearSound);

    // Режим для дитини
    $('btn-kid').addEventListener('click', () => { Sound.unlock(); startKid(); });
    $('kid-exit').addEventListener('click', goHome);
    $('kid-game').addEventListener('click', () => {
      kid.game = kid.game === 'balloon' ? 'candle' : 'balloon';
      Store.set('kidGame', kid.game);
      startKid();
    });

    // «Моя опора»
    $('btn-anchor').addEventListener('click', () => openAnchor(goHome));
    $('anchor-exit').addEventListener('click', closeAnchor);
    $('anchor-save').addEventListener('click', () => {
      const value = $('anchor-input').value.trim();
      Store.set('anchorText', value);
      closeAnchor();
      if (value) toast(tr('anchorSaved'));
    });
    $('anchor-clear').addEventListener('click', () => { Store.set('anchorText', ''); closeAnchor(); });

    // Б1
    $('b1-exit').addEventListener('click', goHome);
    bindRadio($('sleep-mode'), 'value', settings.sleepMode, (v) => { settings.sleepMode = v; Store.set('sleepMode', v); });
    document.querySelectorAll('.lang-btn').forEach((b) => b.addEventListener('click', nextLang));
    bindDetox();
    bindSettings();
    applyLang();
    if (!['off', 'brown', 'rain'].includes(settings.bg)) settings.bg = 'off';
    bindRadio($('bg-sound'), 'value', settings.bg, (v) => { settings.bg = v; Store.set('sleepBg', v); });
    $('btn-sleep-start').addEventListener('click', () => { Sound.unlock(); startSleep(); });

    // Б2: выход только удержанием
    const b2 = $('s-b2');
    b2.addEventListener('pointerdown', (e) => { e.preventDefault(); holdStart(e); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => b2.addEventListener(ev, holdCancel));

    // Стартовий екран: головна або одразу вправа (якщо так обрано в Налаштуваннях)
    if (Store.get('seen', '') !== '1') showScreen('s-intro');
    else {
      showScreen('s-home');
      if (settings.start === 'calm') startFlowA(true);
      else if (settings.start === 'near') startNear();
    }

    // Service Worker: кэширует всё при первом запуске → дальше полный офлайн
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => {});
      });
    }
  }

  init();
})();
