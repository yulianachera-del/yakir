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
    sleepMode: Store.get('sleepMode', 'count'), // count | words | radio
    radioLang: Store.get('radioLang', ''),       // es | it | pt | ro — мова «Радіо»; '' — перша наявна
    // фон для сну: off | brown | rain (стара настройка noise='1' → brown)
    bg: Store.get('sleepBg', Store.get('noise', '0') === '1' ? 'brown' : 'off'),
    voiceCues: Store.get('voiceCues', '1') === '1', // голосові команди в потоці «Скинути напругу»
    lang: Store.get('lang', 'uk'),             // uk | en | ru — мова інтерфейсу й озвучення
    sleepMin: Store.get('sleepMin', '8'),      // 8 | 15 | 25 — тривалість сну
    textSize: Store.get('textSize', 'normal'), // normal | large
    start: Store.get('start', 'home'),         // home | calm | near — що відкривати при запуску
    // normal | slow. Поки рядок «Темп голосу» прихований (#speed-row) — завжди
    // звичайний; з поверненням рядка: Store.get('voiceSpeed', 'normal')
    voiceSpeed: 'normal',
    volume: Store.get('volume', 'mid'),          // low | mid | high — одна гучність для всіх фонових звуків
    theme: Store.get('theme', 'night'),          // night | dusk | dawn — вигляд застосунку
  };
  if (!['night', 'dusk', 'dawn'].includes(settings.theme)) settings.theme = 'night';
  if (!['low', 'mid', 'high'].includes(settings.volume)) settings.volume = 'mid';
  if (!['8', '15', '25'].includes(settings.sleepMin)) settings.sleepMin = '8';
  /* Нативна оболонка (Capacitor, застосунок з Google Play / App Store).
     Вона сама додає window.Capacitor; у браузері його немає і все працює як
     сайт. У застосунку голос, вібрація й «не гасити екран» ідуть через
     нативні модулі: у вбудованому браузері Android, наприклад, немає синтезу мови. */
  const Cap = window.Capacitor;
  const NATIVE = !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform());
  const PLATFORM = NATIVE ? Cap.getPlatform() : 'web';
  const plugin = (name) => (NATIVE && Cap.Plugins && Cap.Plugins[name]) || null;
  if (NATIVE) document.documentElement.classList.add('native', 'native-' + PLATFORM);
  const VOL_GAIN = { low: 0.45, mid: 1, high: 1.6 };
  const VOICE_SPEED = { normal: 1, slow: 0.86 };

  /* ================= 1a. Переклади (UA — основна, далі EN і RU) ================= */
  const I18N = {
    uk: {
      appName: 'Якір',
      intro: 'Працює повністю без інтернету. Допомагає швидко скинути напругу після тривоги або заснути',
      start: 'Почати',
      calmTitle: 'Скинути напругу', calmSub: 'Подихай і відчуй опору •\u00A04\u00A0хвилини',
      near: 'Побути поруч', nearText: 'Я поруч. Нічого не треба робити',
      settings: 'Налаштування', setLang: 'Мова', setTheme: 'Тема', themeNight: 'Ніч', themeDusk: 'Сутінки', themeDawn: 'Світанок', setIcon: 'Іконка застосунку',
      iconDefault: 'Звичайна', iconBright: 'Помітна', iconCalm: 'Спокійна',
      iconHint: 'Нова іконка з’явиться, коли прибереш «Якір» з головного екрана й додаси знову',
      setUpdate: 'Оновлення', version: 'Версія', updCheck: 'Перевірити оновлення', updApply: 'Оновити зараз',
      updChecking: 'Перевіряю…', updLatest: 'У тебе найновіша версія', updFound: 'Є нова версія. Вона вже завантажена',
      updOffline: 'Немає з’єднання з інтернетом. Спробуй пізніше — застосунок працює й так',
      updNoSupport: 'Оновлення приходять самі, коли телефон в інтернеті',
      updPlay: 'Google Play', updAppStore: 'App Store',
      setText: 'Розмір тексту', textLargeLbl: 'Великий текст', cuesHint: 'Голос веде вправу', grpLook: 'Вигляд', grpVoice: 'Звук', grpPractice: 'Вправи', grpAbout: 'Про застосунок', introT1: 'Працює без інтернету', introP1: 'Навіть в укритті чи без зв’язку. Допомагає скинути напругу після тривоги або заснути', introT2: 'Звук веде тебе', introP2: 'Не треба нічого читати: вдих і видих можна почути й відчути. Коли поруч люди — вистачить вібрації або тихого світла на екрані', introT3: 'Усе лишається тут', introP3: 'Без реєстрації й реклами. Твої записи бачиш лише ти — вони не виходять за межі телефона', introNext: 'Далі', introSkip: 'Пропустити', introBad: 'Мені зараз погано — одразу до вправи', introStep: 'Крок {n} з 3', icVoice: 'Звук', icVibro: 'Вібрація', icScreen: 'Лише екран', textNormal: 'Звичайний', textLarge: 'Великий',
      setStart: 'Що відкривати при запуску', startHome: 'Головну',
      startHint: 'Одразу потрапиш у вправу, без вибору. На головну — хрестиком', startSub: 'Одразу у вправу, без вибору',
      setVoice: 'Голос', voiceCuesLbl: 'Голосові підказки', on: 'Увімк.', off: 'Вимк.',
      voiceSpeed: 'Темп голосу', speedSlow: 'Повільніше', speedNormal: 'Звичайно',
      setVolume: 'Гучність фону', volHint: 'Для шуму, дощу й інших фонових звуків',
      volLow: 'Тихіше', volMid: 'Звичайно', volHigh: 'Гучніше',
      setSleep: 'Тривалість сну', min8: '8 хв', min15: '15 хв', min25: '25 хв',
      sleepDurHint: 'Для відліку й для слів. Потім звук і текст тихо згасають',
      donate: 'Підтримати проєкт', donateSub: 'Добровільно. Якір завжди безкоштовний',
      share: 'Поділитися застосунком', shareText: 'Якір — офлайн-самодопомога завжди з тобою: скинути напругу або заснути. Безкоштовно, без реклами.',
      shareCopied: 'Посилання скопійовано',
      resetAll: 'Скинути всі налаштування і мої дані',
      resetWarn: 'Це видалить «Мою опору» і всі налаштування на цьому телефоні. Повернути їх не вийде',
      resetYes: 'Так, скинути', cancel: 'Скасувати',
      tapToStart: 'Торкнись екрана, щоб почати',
      privacy: 'Приватність', kid: 'Для дитини', kBalloon: 'Кулька', kCandle: 'Свічка', kidTipBtn: 'Порада дорослому', kidStep: 'Крок {n} з {total}',
      kidTip: 'Дорослому: дихайте разом із дитиною, повільно й уголос. Не виправляйте — хваліть за кожен видих',
      kInB: 'Вдихни носиком — набери повітря', kOutB: 'А тепер дуй у кульку!', kDoneB: 'Вийшло! Кулька полетіла',
      kInC: 'Понюхай квіточку', kOutC: 'Тихенько подуй на свічку', kDoneC: 'Чудово! Вогник тобі помахав', kSubInC: 'повільно, носиком', kSubOutC: 'щоб вогник лише хитнувся',
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
      anchorPh: 'Наприклад: «Це мине. Я впораюся»', anchorExample: 'Це мине. Я впораюся', anchorNote: 'Зберігається лише на цьому телефоні',
      anchorSave: 'Зберегти', anchorClear: 'Прибрати', anchorSaved: 'Збережено. Хай ця фраза гріє тебе',
      back: 'Назад',
      sleepTitle: 'Допомогти заснути', sleepSub: 'Відлік, образи або радіо здалеку',
      calmEyebrow: 'Зараз важко', tileNear: 'Поруч', tileKid: 'Дитині', anchorAdd: 'Моя опора — додай свою фразу',
      greetMorning: 'Доброго ранку', greetDay: 'Добрий день', greetEvening: 'Добрий вечір', greetNight: 'Тиха ніч',
      fbSound: 'Звук + Вібро', fbVibro: 'Тільки Вібро', fbVisual: 'Лише візуал',
      feedbackLabel: 'Режим відгуку', langLabel: 'Мова', sleepModeLabel: 'Режим засинання',
      exit: 'Вийти на головний екран', skip: 'Пропустити',
      ready: 'Приготуйся', inhale: 'Вдих носом', topup: 'Довдих', exhale: 'Повільний видих ротом',
      m1t: 'Стисни кулаки й підніми плечі до вух', m1r: 'Різко кинь і розслаб',
      m2t: 'Сильно заплющ очі й стисни зуби', m2r: 'Розслаб обличчя й опусти щелепу',
      m3t: 'Напруж ноги, живіт і спину', m3r: 'Повністю розслабся',
      g5: 'Знайди поглядом 5 будь-яких предметів навколо й натискай на екран на кожен',
      g4: 'Торкнися 4 різних поверхонь поруч (ковдра, стіна, телефон...)',
      g3: 'Прислухайся до 3 звуків',
      g2: 'Зроби 2 глибокі спокійні видихи',
      g1: 'Відчуй, як тіло спирається на ліжко чи підлогу',
      tapAnywhere: 'Натискай будь-де на екрані',
      finalText: 'Пульс вирівнюється',
      toSleep: 'Перейти до засинання', toHome: 'На головну',
      countTitle: 'Зворотний відлік (100 → 0)', countSub: 'Монотонний рахунок назад, темп сповільнюється',
      wordsTitle: 'Образи (Перемішування)', wordsSub: 'Випадкові спокійні слова, {m} хвилин',
      radioTitle: 'Радіо здалеку', radioSub: 'Тихий голос читає незнайомою мовою — як прогноз погоди вночі',
      radioLangLbl: 'Мова радіо',
      radioTune: 'Шкала налаштування: потягни, щоб знайти іншу станцію',
      radioGap: 'ніде|між світами|десь між містами|між хвилями|нічний ефір|в морі',
      radioNoVoice: 'Для радіо потрібен голос іспанської, італійської, португальської або румунської мови. Додай його в налаштуваннях телефона: Синтезатор мовлення Google → Встановити голосові дані',
      bgSound: 'Фоновий звук', bgOff: 'Без', bgBrown: 'Шум', bgRain: 'Дощ',
      noteTap: 'Торкнись екрана, щоб почати одразу', voiceLang: 'Мова озвучення',
      sleepStart: 'Заплющити очі й почати',
      hintVisual: 'Режим «Лише візуал»: без голосу, лише тьмяний текст',
      hintNoVoice: 'Голосу для цієї мови на пристрої не знайдено — буде лише текст',
      detox: 'Детокс', detoxBack: 'Назад до Детоксу',
      detoxLead: 'Тут немає завдань і оцінок. Обери те, що зараз ближче',
      dDraw: 'Малювання світлом', dDrawSub: 'Лінії світяться й тануть',
      dGarden: 'Звуковий сад', dGardenSub: 'Кожен дотик звучить м’яко',
      dBubbles: 'Тиха вода', dBubblesSub: 'Дощ із бульбашками, краплі на склі, хвилі', wavesHint: 'Торкнися води — піде легка брижа.\nМісяць і зорі можна пересувати',
      scRain: 'Дощ', scGlass: 'Краплі на склі', scWaves: 'Хвилі',
      dSmile: 'Про те, про се', dSmileSub: 'Знайоме ні про що', smileNext: 'Ще одну',
      dThought: 'Відпустити думку', dThoughtSub: 'Напиши — і дивись, як воно тане',
      dStep: 'Маленький крок', dStepSub: 'Одна крихітна дія для себе',
      kaleido: 'Калейдоскоп',
      gardenHint: 'Торкайся будь-де', gardenMuted: 'Звук вимкнено в режимі відгуку — лишилися кола',
      thoughtPh: 'Пиши сюди. Це ніхто не побачить', thoughtGo: 'Відпустити',
      thoughtNote: 'Нічого не зберігається', thoughtDone: 'Відпущено. Можна видихнути',
      stepNext: 'Інший крок', stepNote: 'Лише якщо хочеться',
      st1: 'Дихання', st2: 'Тіло', st3: 'Опора', stagesLabel: 'Етапи практики',
      voiceToggle: 'Звук',
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
      calmTitle: 'Release tension', calmSub: 'Breathe and feel steady again •\u00A04\u00A0minutes',
      near: 'Stay with me', nearText: 'I’m here. You don’t have to do anything',
      settings: 'Settings', setLang: 'Language', setTheme: 'Theme', themeNight: 'Night', themeDusk: 'Dusk', themeDawn: 'Dawn', setIcon: 'App icon',
      iconDefault: 'Standard', iconBright: 'Bright', iconCalm: 'Calm',
      iconHint: 'The new icon appears after you remove “Anchor” from the home screen and add it again',
      setUpdate: 'Updates', version: 'Version', updCheck: 'Check for updates', updApply: 'Update now',
      updChecking: 'Checking…', updLatest: 'You have the latest version', updFound: 'A new version is ready. It has already downloaded',
      updOffline: 'No internet connection. Try later — the app works anyway',
      updNoSupport: 'Updates arrive on their own when the phone is online',
      updPlay: 'Google Play', updAppStore: 'App Store',
      setText: 'Text size', textLargeLbl: 'Large text', cuesHint: 'A voice guides the practice', grpLook: 'Appearance', grpVoice: 'Sound', grpPractice: 'Practices', grpAbout: 'About', introT1: 'Works offline', introP1: 'Even in a shelter or with no signal. Helps you release tension after an alert or fall asleep', introT2: 'Sound guides you', introP2: 'No need to read anything: you hear and feel each breath. With people around, vibration or a soft light on the screen is enough', introT3: 'Everything stays here', introP3: 'No sign-up, no ads. Only you can see what you write — it never leaves your phone', introNext: 'Next', introSkip: 'Skip', introBad: 'I feel bad right now — go to the exercise', introStep: 'Step {n} of 3', icVoice: 'Sound', icVibro: 'Vibration', icScreen: 'Screen only', textNormal: 'Normal', textLarge: 'Large',
      setStart: 'Open on launch', startHome: 'Home',
      startHint: 'Go straight into the practice, no choosing. ✕ takes you home', startSub: 'Straight into the practice',
      setVoice: 'Voice', voiceCuesLbl: 'Voice prompts', on: 'On', off: 'Off',
      voiceSpeed: 'Voice pace', speedSlow: 'Slower', speedNormal: 'Normal',
      setVolume: 'Background volume', volHint: 'For noise, rain and other background sounds',
      volLow: 'Quieter', volMid: 'Normal', volHigh: 'Louder',
      setSleep: 'Sleep length', min8: '8 min', min15: '15 min', min25: '25 min',
      sleepDurHint: 'For counting and for words. Then sound and text fade quietly',
      donate: 'Support the project', donateSub: 'Optional. Anchor is always free',
      share: 'Share the app', shareText: 'Anchor — offline self-help that is always with you: release tension or fall asleep. Free, no ads.',
      shareCopied: 'Link copied',
      resetAll: 'Reset all settings and my data',
      resetWarn: 'This deletes “My anchor” and all settings on this phone. It can’t be undone',
      resetYes: 'Yes, reset', cancel: 'Cancel',
      tapToStart: 'Tap the screen to begin',
      privacy: 'Privacy', kid: 'For a child', kBalloon: 'Balloon', kCandle: 'Candle', kidTipBtn: 'Tip for the adult', kidStep: 'Step {n} of {total}',
      kidTip: 'For the adult: breathe together with the child, slowly and out loud. Don’t correct — praise every breath out',
      kInB: 'Breathe in through your nose — fill up with air', kOutB: 'Now blow into the balloon!', kDoneB: 'You did it! The balloon flew away',
      kInC: 'Smell the flower', kOutC: 'Gently blow on the candle', kDoneC: 'Lovely! The flame waved at you', kSubInC: 'slowly, through your nose', kSubOutC: 'so the flame just wobbles',
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
      anchorPh: 'For example: “This will pass. I can do this”', anchorExample: 'This will pass. I can do this', anchorNote: 'Saved only on this phone',
      anchorSave: 'Save', anchorClear: 'Remove', anchorSaved: 'Saved. Let these words keep you warm',
      back: 'Back',
      sleepTitle: 'Help me sleep', sleepSub: 'Countdown, images or distant radio',
      calmEyebrow: 'Hard right now', tileNear: 'Be near', tileKid: 'For a child', anchorAdd: 'My anchor — add your phrase',
      greetMorning: 'Good morning', greetDay: 'Good afternoon', greetEvening: 'Good evening', greetNight: 'Quiet night',
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
      radioTitle: 'Distant radio', radioSub: 'A quiet voice reads in an unfamiliar language — like a night weather forecast',
      radioLangLbl: 'Radio language',
      radioTune: 'Tuning dial: drag to find another station',
      radioGap: 'nowhere|between worlds|somewhere between cities|between the waves|night air|at sea',
      radioNoVoice: 'The radio needs a Spanish, Italian, Portuguese or Romanian voice. Add one in your phone settings: Speech Recognition & Synthesis by Google → Install voice data',
      bgSound: 'Background sound', bgOff: 'None', bgBrown: 'Noise', bgRain: 'Rain',
      noteTap: 'Tap the screen to start right away', voiceLang: 'Voice language',
      sleepStart: 'Close your eyes and start',
      hintVisual: '“Visual only” mode: no voice, only dim text',
      hintNoVoice: 'No voice for this language was found on the device — text only',
      detox: 'Detox', detoxBack: 'Back to Detox',
      detoxLead: 'No tasks, no scores. Pick whatever feels closest right now',
      dDraw: 'Light drawing', dDrawSub: 'Move your finger — lines glow and melt away',
      dGarden: 'Sound garden', dGardenSub: 'Touch the screen — every touch sounds soft',
      dBubbles: 'Quiet water', dBubblesSub: 'Rain with bubbles, drops on glass, waves', wavesHint: 'Touch the water for a gentle ripple.\nYou can move the moon and the stars',
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
      voiceToggle: 'Sound',
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
      calmTitle: 'Сбросить напряжение', calmSub: 'Подыши и почувствуй опору •\u00A04\u00A0минуты',
      near: 'Побыть рядом', nearText: 'Я рядом. Ничего не нужно делать',
      settings: 'Настройки', setLang: 'Язык', setTheme: 'Тема', themeNight: 'Ночь', themeDusk: 'Сумерки', themeDawn: 'Рассвет', setIcon: 'Иконка приложения',
      iconDefault: 'Обычная', iconBright: 'Заметная', iconCalm: 'Спокойная',
      iconHint: 'Новая иконка появится, когда уберёшь «Якорь» с главного экрана и добавишь снова',
      setUpdate: 'Обновления', version: 'Версия', updCheck: 'Проверить обновления', updApply: 'Обновить сейчас',
      updChecking: 'Проверяю…', updLatest: 'У тебя самая новая версия', updFound: 'Есть новая версия. Она уже загружена',
      updOffline: 'Нет подключения к интернету. Попробуй позже — приложение работает и так',
      updNoSupport: 'Обновления приходят сами, когда телефон в интернете',
      updPlay: 'Google Play', updAppStore: 'App Store',
      setText: 'Размер текста', textLargeLbl: 'Крупный текст', cuesHint: 'Голос ведёт упражнение', grpLook: 'Внешний вид', grpVoice: 'Звук', grpPractice: 'Упражнения', grpAbout: 'О приложении', introT1: 'Работает без интернета', introP1: 'Даже в укрытии или без связи. Помогает снять напряжение после тревоги или уснуть', introT2: 'Звук ведёт тебя', introP2: 'Ничего не нужно читать: вдох и выдох можно услышать и почувствовать. Если рядом люди — хватит вибрации или тихого света на экране', introT3: 'Всё остаётся здесь', introP3: 'Без регистрации и рекламы. Твои записи видишь только ты — они не покидают телефон', introNext: 'Дальше', introSkip: 'Пропустить', introBad: 'Мне сейчас плохо — сразу к упражнению', introStep: 'Шаг {n} из 3', icVoice: 'Звук', icVibro: 'Вибрация', icScreen: 'Только экран', textNormal: 'Обычный', textLarge: 'Крупный',
      setStart: 'Что открывать при запуске', startHome: 'Главную',
      startHint: 'Сразу попадёшь в упражнение, без выбора. На главную — крестиком', startSub: 'Сразу в упражнение, без выбора',
      setVoice: 'Голос', voiceCuesLbl: 'Голосовые подсказки', on: 'Вкл.', off: 'Выкл.',
      voiceSpeed: 'Темп голоса', speedSlow: 'Медленнее', speedNormal: 'Обычно',
      setVolume: 'Громкость фона', volHint: 'Для шума, дождя и других фоновых звуков',
      volLow: 'Тише', volMid: 'Обычно', volHigh: 'Громче',
      setSleep: 'Длительность сна', min8: '8 мин', min15: '15 мин', min25: '25 мин',
      sleepDurHint: 'Для отсчёта и для слов. Потом звук и текст тихо гаснут',
      donate: 'Поддержать проект', donateSub: 'Добровольно. Якорь всегда бесплатный',
      share: 'Поделиться приложением', shareText: 'Якорь — офлайн-самопомощь всегда с тобой: снять напряжение или заснуть. Бесплатно, без рекламы.',
      shareCopied: 'Ссылка скопирована',
      resetAll: 'Сбросить все настройки и мои данные',
      resetWarn: 'Это удалит «Мою опору» и все настройки на этом телефоне. Вернуть их не получится',
      resetYes: 'Да, сбросить', cancel: 'Отмена',
      tapToStart: 'Коснись экрана, чтобы начать',
      privacy: 'Конфиденциальность', kid: 'Для ребёнка', kBalloon: 'Шарик', kCandle: 'Свеча', kidTipBtn: 'Совет взрослому', kidStep: 'Шаг {n} из {total}',
      kidTip: 'Взрослому: дышите вместе с ребёнком, медленно и вслух. Не поправляйте — хвалите за каждый выдох',
      kInB: 'Вдохни носиком — набери воздух', kOutB: 'А теперь дуй в шарик!', kDoneB: 'Получилось! Шарик улетел',
      kInC: 'Понюхай цветочек', kOutC: 'Тихонько подуй на свечу', kDoneC: 'Чудесно! Огонёк тебе помахал', kSubInC: 'медленно, носиком', kSubOutC: 'чтобы огонёк только качнулся',
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
      anchorPh: 'Например: «Это пройдёт. Я справлюсь»', anchorExample: 'Это пройдёт. Я справлюсь', anchorNote: 'Хранится только на этом телефоне',
      anchorSave: 'Сохранить', anchorClear: 'Убрать', anchorSaved: 'Сохранено. Пусть эта фраза греет тебя',
      back: 'Назад',
      sleepTitle: 'Помочь уснуть', sleepSub: 'Отсчёт, образы или радио издалека',
      calmEyebrow: 'Сейчас тяжело', tileNear: 'Рядом', tileKid: 'Ребёнку', anchorAdd: 'Моя опора — добавь свою фразу',
      greetMorning: 'Доброе утро', greetDay: 'Добрый день', greetEvening: 'Добрый вечер', greetNight: 'Тихой ночи',
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
      radioTitle: 'Радио издалека', radioSub: 'Тихий голос читает на незнакомом языке — как прогноз погоды ночью',
      radioLangLbl: 'Язык радио',
      radioTune: 'Шкала настройки: потяни, чтобы найти другую станцию',
      radioGap: 'нигде|между мирами|где-то между городами|между волнами|ночной эфир|в море',
      radioNoVoice: 'Для радио нужен голос испанского, итальянского, португальского или румынского языка. Добавь его в настройках телефона: Синтезатор речи Google → Установить голосовые данные',
      bgSound: 'Фоновый звук', bgOff: 'Без', bgBrown: 'Шум', bgRain: 'Дождь',
      noteTap: 'Коснись экрана, чтобы начать сразу', voiceLang: 'Язык озвучки',
      sleepStart: 'Закрыть глаза и начать',
      hintVisual: 'Режим «Только визуал»: без голоса, только тусклый текст',
      hintNoVoice: 'Голос для этого языка не найден на устройстве — будет только текст',
      detox: 'Детокс', detoxBack: 'Назад к Детоксу',
      detoxLead: 'Здесь нет заданий и оценок. Выбери то, что сейчас ближе',
      dDraw: 'Рисование светом', dDrawSub: 'Води пальцем — линии светятся и тают',
      dGarden: 'Звуковой сад', dGardenSub: 'Касайся экрана — каждое касание звучит мягко',
      dBubbles: 'Тихая вода', dBubblesSub: 'Дождь с пузырями, капли на стекле, волны', wavesHint: 'Коснись воды — пойдёт лёгкая рябь.\nЛуну и звёзды можно передвигать',
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
      voiceToggle: 'Звук',
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
    paintFeedback();
    glueTileIcons();
    document.querySelectorAll('#set-lang button').forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset.value === settings.lang));
    });
    if (typeof paintFolds === 'function') paintFolds();
    updateVoiceHint();
  }
  /* Детокс: значок «приклеєний» до останнього слова назви — переноситься
     лише разом із ним і ніколи не стоїть сам на рядку. */
  function glueTileIcons() {
    document.querySelectorAll('.tile-head').forEach((h) => {
      const title = h.querySelector('.tabs__title');
      const ico = h._ico || (h._ico = h.querySelector('svg.ico'));
      if (!title || !ico) return;
      const words = tr(title.dataset.i18n).trim().split(/\s+/);
      const last = words.pop();
      const tail = document.createElement('span');
      tail.className = 'tile-tail';
      tail.append(last, ico);
      title.textContent = words.length ? words.join(' ') + ' ' : '';
      title.append(tail);
    });
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
        g.gain.value = VOL_GAIN[settings.volume] || 1;
        g.connect(this._limiter);
        this.buses[name] = g;
      }
      return this.buses[name];
    },
    /* Шина записаного голосу: не залежить від «Гучності фону» і звучить
       удвічі гучніше (+6 дБ) — щоб слова й числа було чути крізь шум і дощ.
       Іде через той самий обмежувач, тож не хрипить. */
    _voice() {
      if (!this._voiceBus) {
        this._out('fx'); // створює обмежувач
        const g = this.ctx.createGain();
        g.gain.value = 2;
        g.connect(this._limiter);
        this._voiceBus = g;
      }
      return this._voiceBus;
    },
    setVolume(level) {
      Object.values(this.buses).forEach((g) => g.gain.setTargetAtTime(VOL_GAIN[level] || 1, this.ctx.currentTime, 0.15));
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

    /* Дзвіночок вправи «Тіло»: чиста основна нота й тихі «металеві»
       обертони (2.76 і 5.4), що згасають швидше за неї. */
    softBell(freq, level = 0.09, decay = 4) {
      if (!this.ready) return;
      const c = this.ctx, t0 = c.currentTime;
      [[1, 1], [2.76, 0.18], [5.4, 0.05]].forEach(([m, a]) => {
        const osc = c.createOscillator(), g = c.createGain(), end = t0 + decay / Math.sqrt(m);
        osc.type = 'sine';
        osc.frequency.value = freq * m;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(level * a, t0 + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, end);
        osc.connect(g).connect(this._out('fx'));
        osc.start(t0); osc.stop(end + 0.05);
        this._track(osc, g);
      });
    },

    /* Нота Звукового саду. Динамік телефона майже не відтворює низькі
       частоти, тож низькі ноти чути як «тихіші»: для них підсилюємо рівень
       і додаємо обертони (2-й і 3-й), за якими вухо «добудовує» основний тон. */
    chime(freq) {
      if (!this.ready) return;
      const low = Math.min(1, Math.max(0, (520 - freq) / 258)); // 1 для найнижчої (262 Гц), 0 від 520 Гц
      const high = Math.min(1, Math.max(0, (freq - 600) / 280)); // високі вухо чує гучніше — трохи тихіше
      const level = 0.2 + low * 0.14 - high * 0.05;
      const c = this.ctx, t0 = c.currentTime, g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(level, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.8);
      g.connect(this._out('fx'));
      [[1, 1], [2, 0.22 + low * 0.5], [3, low * 0.26], [4, low * 0.1]].forEach(([mult, part]) => {
        if (part <= 0) return;
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

    /* Тибетська чаша: м'який удар і тон, що стихає, але звучить до кінця
       фази. Обертони неґармонічні (як у справжньої чаші), кожен — пара ледь
       розстроєних тонів, звідси повільне «вау-вау» биття. */
    bowl(freq, sec, level = 1) {
      if (!this.ready) return;
      const c = this.ctx, t0 = c.currentTime, end = t0 + sec;
      const L = 0.075 * level;
      // [множник, сила, частка, що лишається звучати, швидкість биття, Гц]
      [[1, 1, 0.5, 0.9], [2.83, 0.32, 0.28, 1.7], [5.4, 0.1, 0.12, 2.6], [8.9, 0.035, 0.05, 3.4]].forEach(([m, a, keep, beat]) => {
        const g = c.createGain(), peak = L * a;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(peak, t0 + 0.025 + 0.02 * m / 9);
        // спершу помітно стихає, далі тримається й повільно тане до кінця фази
        g.gain.setTargetAtTime(peak * keep, t0 + 0.05, 0.35 + 0.5 / m);
        g.gain.setTargetAtTime(peak * keep * 0.6, t0 + 1.2, Math.max(0.6, sec * 0.5));
        g.gain.setTargetAtTime(0.0001, end - 0.05, 0.22);
        g.connect(this._out('fx'));
        [-beat / 2, beat / 2].forEach((det) => {
          const o = c.createOscillator();
          o.type = 'sine';
          o.frequency.value = freq * m + det;
          o.connect(g);
          o.start(t0); o.stop(end + 1.2);
          this._track(o, g);
        });
      });
    },
    /* Дзвіночки для дитини: світлий тон, що тягнеться всю фазу, і поверх —
       тихі дзинь-дзинь: на вдиху вгору, на видиху вниз. */
    chimes(up, sec, level = 1) {
      if (!this.ready) return;
      const c = this.ctx, t0 = c.currentTime, end = t0 + sec;
      const base = up ? 523.25 : 392;
      [[1, 1, 0.45], [2, 0.22, 0.2], [3.01, 0.07, 0.08]].forEach(([m, a, keep]) => {
        const g = c.createGain(), peak = 0.05 * level * a;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(peak, t0 + 0.02);
        g.gain.setTargetAtTime(peak * keep, t0 + 0.04, 0.5);
        g.gain.setTargetAtTime(0.0001, end - 0.05, 0.2);
        g.connect(this._out('fx'));
        [-0.7, 0.7].forEach((det) => {
          const o = c.createOscillator();
          o.type = 'sine'; o.frequency.value = base * m + det;
          o.connect(g); o.start(t0); o.stop(end + 1);
          this._track(o, g);
        });
      });
      // пентатоніка C-D-E-G-A: що б не збіглося, звучить лагідно
      const notes = [1046.5, 1174.7, 1318.5, 1568, 1760];
      const seq = up ? notes : notes.slice().reverse();
      const n = Math.max(3, Math.min(5, Math.round(sec / 0.8)));
      for (let i = 0; i < n; i++) {
        const at = t0 + 0.25 + (i * (sec - 0.6)) / n, f = seq[i % seq.length];
        [[1, 1], [2.76, 0.12]].forEach(([m, a]) => {
          const o = c.createOscillator(), g = c.createGain(), stop = at + 1.4 / m;
          o.type = 'sine'; o.frequency.value = f * m;
          g.gain.setValueAtTime(0.0001, at);
          g.gain.exponentialRampToValueAtTime(0.022 * level * a, at + 0.008);
          g.gain.exponentialRampToValueAtTime(0.0001, stop);
          o.connect(g).connect(this._out('fx'));
          o.start(at); o.stop(stop + 0.05);
          this._track(o, g);
        });
      }
    },
    /* М'яке відлуння для дзвоників дихання. Не ConvolverNode: згортка з
       довгим хвостом на телефонах перевантажувала аудіопотік (тріск і паузи).
       Тут дві короткі лінії затримки зі зворотним зв'язком — майже нічого не
       коштують, а простір чути. Створюються один раз і живуть далі. */
    _echoIn() {
      if (!this._echo) {
        const c = this.ctx, inp = c.createGain(), wet = c.createGain();
        wet.gain.value = 0.3;
        wet.connect(this._out('fx'));
        [[0.137, 0.42], [0.229, 0.34]].forEach(([time, fbk]) => {
          const d = c.createDelay(1), lp = c.createBiquadFilter(), fb = c.createGain();
          d.delayTime.value = time;
          lp.type = 'lowpass'; lp.frequency.value = 2400;
          fb.gain.value = fbk;
          inp.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(wet);
        });
        this._echo = inp;
      }
      return this._echo;
    },
    /* «Дзвоники-хмаринка»: три м'які дзвоники акордом (легкий удар і тон,
       що тягнеться до кінця фази). На вдиху акорд світлий, на «ще трошки» —
       трохи вищий, на видиху — тепліший і нижчий. Обрано за пробою (листопад 2026). */
    cloud(up, sec, top = false, level = 1) {
      if (!this.ready) return;
      const c = this.ctx, t0 = c.currentTime;
      const chord = top ? [440, 587.3, 880] : up ? [523.3, 659.3, 784] : [440, 523.3, 659.3];
      // один спільний вихід на всю фазу: сухий звук + відлуння
      const dst = c.createGain();
      dst.connect(this._out('fx')); dst.connect(this._echoIn());
      chord.forEach((f, i) => {
        const t = t0 + i * 0.12, end = t0 + sec;
        // удар дзвоника: чиста нота з легкими обертонами
        [[1, 1], [2, 0.22], [3, 0.07]].forEach(([m, a]) => {
          const o = c.createOscillator(), g = c.createGain(), e = t + 3 / Math.sqrt(m);
          o.type = 'sine'; o.frequency.value = f * m;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.022 * level * a, t + 0.006);
          g.gain.exponentialRampToValueAtTime(0.0001, e);
          o.connect(g).connect(dst);
          o.start(t); o.stop(e + 0.05);
          this._track(o, g);
        });
        // тягучий тон: ледь розстроєна пара — повільне мерехтіння
        const g = c.createGain();
        g.connect(dst);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.016 * level, t + 0.6);
        g.gain.setTargetAtTime(0.016 * level * 0.75, t + 0.6, 0.6);
        g.gain.setTargetAtTime(0.0001, end - 0.05, 0.25);
        [-0.175, 0.175].forEach((d) => {
          const o = c.createOscillator();
          o.type = 'sine'; o.frequency.value = f + d;
          o.connect(g); o.start(t); o.stop(end + 0.9); // хвіст згасає за ~0,8 с
          this._track(o, g);
        });
      });
    },
    /* Звуки дихання замість голосових підказок: «Дзвоники-хмаринка».
       Повертає true: тон-провідник тоді не потрібен. */
    breathIn(sec, level = 1) {
      if (!this.ready) return false;
      this.cloud(true, sec, level < 1); // «ще трошки» (level < 1) — вищий акорд
      return true;
    },
    breathOut(sec, level = 1) {
      if (!this.ready) return false;
      this.cloud(false, sec);
      return true;
    },
    /* М'яке постукування (подушечкою пальця): низький глухий тон і ледь
       чутний шурхіт. side: -1 ліворуч, 1 праворуч, 0 по центру */
    tap(side = 0, level = 1) {
      if (!this.ready) return;
      const c = this.ctx, t0 = c.currentTime;
      const out = c.createGain();
      out.gain.value = level;
      let dest = this._out('fx');
      if (c.createStereoPanner && side) {
        const p = c.createStereoPanner();
        p.pan.value = side * 0.7;
        p.connect(dest); dest = p;
      }
      out.connect(dest);
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(190, t0);
      o.frequency.exponentialRampToValueAtTime(120, t0 + 0.12);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      o.connect(g).connect(out);
      o.start(t0); o.stop(t0 + 0.25);
      this._track(o, g);
      const s = c.createBufferSource(), f = c.createBiquadFilter(), ng = c.createGain();
      s.buffer = this._whiteBuf();
      f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.2;
      ng.gain.setValueAtTime(0.0001, t0);
      ng.gain.exponentialRampToValueAtTime(0.03, t0 + 0.004);
      ng.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
      s.connect(f).connect(ng).connect(out);
      s.start(t0, Math.random() * 2, 0.08);
      this._track(s, ng);
    },

    /* Тихий «хлюп» від дотику до води: коротка булька (синус, що швидко
       падає вниз) і ледь чутний мокрий шелест. Висота щоразу трохи інша. */
    plop(level = 1) {
      if (!this.ready) return;
      const c = this.ctx, t0 = c.currentTime, f = 300 + Math.random() * 160;
      const osc = c.createOscillator(), g = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t0);
      osc.frequency.exponentialRampToValueAtTime(f * 0.45, t0 + 0.14);
      g.gain.setValueAtTime(0.0001, t0);
      // утричі гучніше за першу версію: шум хвиль низький, а хлюп — у середині
      // діапазону, тож його чути крізь хвилі, не перекрикуючи їх
      g.gain.exponentialRampToValueAtTime(0.16 * level, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
      osc.connect(g).connect(this._out('fx'));
      osc.start(t0); osc.stop(t0 + 0.22);
      this._track(osc, g);
      this._whoosh(0.01, 1600, 550, 2.2, 0.06 * level, 0.02, 0.24);
    },

    /* Хвилі: м'який сплеск-шелест води, сила 0..1 */
    splash(strength = 0.5) {
      if (!this.ready) return;
      const k = Math.max(0.15, Math.min(1, strength));
      this._whoosh(0, 1100, 260, 0.6, 0.03 + 0.06 * k, 0.06, 0.7 + 0.6 * k);
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
    _load(path) {
      // кешуємо саме обіцянку: два одночасні запити не тягнуть файл двічі
      if (this.buffers.has(path)) return this.buffers.get(path);
      const p = fetch('audio/' + path)
        .then((res) => res.arrayBuffer())
        .then((raw) => new Promise((ok, fail) => Sound.ctx.decodeAudioData(raw, ok, fail)));
      this.buffers.set(path, p);
      p.catch(() => this.buffers.delete(path));
      // розпакований звук важкий — тримаємо в пам'яті лише останні 40 кліпів
      if (this.buffers.size > 40) this.buffers.delete(this.buffers.keys().next().value);
      return p;
    },
    // Завантажити наперед, поки триває пауза, — щоб наступне число не запізнювалось
    preload(path) {
      if (this.has(path) && !this.buffers.has(path)) this._load(path).catch(() => {});
    },
    /* opts.bus — інший вихід (шкала «Радіо» глушить голос між станціями);
       opts.mid — почати з випадкового місця, ніби передача вже йшла */
    async play(path, volume, onFail, opts = {}) {
      // Якщо попередній кліп от-от закінчиться (≤ 0,7 с), новий стане в чергу
      // одразу за ним, а не обірве останнє слово.
      const prev = this.current, c0 = Sound.ctx;
      const tail = prev && c0 && prev.end - c0.currentTime <= 0.7 ? prev : null;
      if (tail) { this.gen++; this.current = null; } else this.stop();
      const gen = this.gen;
      // finished — обіцянка «кліп дозвучав» (або не зазвучав зовсім): за нею
      // відлік рахує паузу від кінця числа, а не від початку
      let fin;
      this.finished = new Promise((r) => { fin = r; });
      try {
        const buffer = await this._load(path);
        if (gen !== this.gen) { fin(); return; }
        const c = Sound.ctx, src = c.createBufferSource(), g = c.createGain();
        src.buffer = buffer;
        src.connect(g).connect(opts.bus || Sound._voice());
        const at = Math.max(c.currentTime, tail ? tail.end : 0);
        const off = opts.mid ? buffer.duration * (0.15 + Math.random() * 0.55) : 0;
        if (off) { g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(volume, at + 0.08); }
        else g.gain.value = volume;
        src.start(at, off);
        this.current = { src, g, end: at + buffer.duration - off };
        src.onended = () => { if (this.current && this.current.src === src) this.current = null; fin(); };
      } catch (e) {
        fin();
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
    timers: [],
    /* У застосунку — нативна вібрація. iPhone не вміє задавати тривалість,
       тому там кожен імпульс — м'який «тап» Taptic Engine (сила за тривалістю). */
    _native(list) {
      const H = plugin('Haptics');
      if (!H) return false;
      this._clearTimers();
      let offset = 0;
      list.forEach((ms, i) => {
        if (i % 2 === 0 && ms > 0) {
          const fire = () => {
            const p = PLATFORM === 'ios'
              ? H.impact({ style: ms >= 35 ? 'MEDIUM' : 'LIGHT' })
              : H.vibrate({ duration: ms });
            if (p && p.catch) p.catch(() => {});
          };
          if (offset === 0) fire(); else this.timers.push(setTimeout(fire, offset));
        }
        offset += ms;
      });
      return true;
    },
    _clearTimers() { this.timers.forEach(clearTimeout); this.timers = []; },
    play(pattern) {
      if (settings.feedback === 'visual') return;
      const list = Array.isArray(pattern) ? pattern : [pattern];
      if (NATIVE && this._native(list)) return;
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
      this._clearTimers();
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
    on() {
      this.wanted = true;
      const K = plugin('KeepAwake');
      if (K) { K.keepAwake().catch(() => {}); return; }
      this._request();
    },
    async _request() {
      if (plugin('KeepAwake')) return;
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
      const K = plugin('KeepAwake');
      if (K) K.allowSleep().catch(() => {});
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
    tts: null,          // нативний синтезатор (у застосунку)
    nativeLangs: null,  // мови, які він уміє: ['uk-UA', 'en-US', ...]; null — ще не відомо
    LANG_TAG: { uk: 'uk-UA', en: 'en-US', ru: 'ru-RU' },
    init() {
      this.tts = plugin('TextToSpeech');
      if (this.tts) {
        /* Синтезатор телефона запускається не одразу: якщо спитати мови
           зарано, відповідь порожня або помилка. Тому питаємо кілька разів,
           а порожній список не вважаємо відповіддю «голосу немає». */
        const ask = (tries) => this.tts.getSupportedLanguages()
          .then((r) => (r && r.languages) || [])
          .catch(() => [])
          .then((list) => {
            if (list.length) { this.nativeLangs = list; updateVoiceHint(); }
            else if (tries > 0) setTimeout(() => ask(tries - 1), 1500);
          });
        ask(8);
        return;
      }
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
      if (this.tts) {
        if (!this.nativeLangs) return true; // список ще вантажиться — пробуємо
        return this.nativeLangs.some((l) => String(l).toLowerCase().replace('_', '-').startsWith(lang));
      }
      if (!this.synth) return false;
      if (this.voices.length === 0) return !this.settled; // після очікування порожній список = голосів немає
      return !!this.voiceFor(lang);
    },
    /* Возвращает false, если произнести нельзя — вызывающий код
       переходит на вибро/визуал. onFail срабатывает при ошибке движка. */
    speak(text, lang, rate, volume, onFail) {
      if (!this.available(lang)) return false;
      if (this.tts) {
        // нова фраза перериває попередню (QUEUE_FLUSH усередині модуля)
        this.tts.speak({
          text, lang: this.LANG_TAG[lang], volume,
          rate: rate * this.RATE_FACTOR * (VOICE_SPEED[settings.voiceSpeed] || 1),
          pitch: this.PITCH, category: 'playback',
        }).catch(() => { if (onFail) onFail(); });
        return true;
      }
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
    /* Чи є голос для мови (будь-якої, напр. 'es' для «Радіо») — без «пробуємо» */
    hasLang(lang) {
      const norm = (l) => String(l).toLowerCase().replace('_', '-');
      if (this.tts) {
        const hit = (this.nativeLangs || []).find((l) => norm(l).startsWith(lang));
        return hit ? String(hit).replace('_', '-') : null;
      }
      const v = this.voices.find((x) => norm(x.lang || '').startsWith(lang));
      return v ? v.lang.replace('_', '-') : null;
    },
    /* Фраза чужою мовою для «Радіо». Повертає Promise, що завершується,
       коли фразу дочитано (або сталася помилка). */
    speakForeign(text, tag, rate, volume, interrupt) {
      const pitch = 0.78; // нижчий, рівніший голос
      if (this.tts) {
        // У черзі (QUEUE_ADD = 1): фраза дочитується до кінця, а не обривається
        // наступною. Перервати можна лише зразок мови (interrupt).
        return this.tts.speak({ text, lang: tag, rate, pitch, volume, category: 'playback', queueStrategy: interrupt ? 0 : 1 }).catch(() => {});
      }
      if (!this.synth) return Promise.resolve();
      return new Promise((resolve) => {
        try {
          if (interrupt && (this.synth.speaking || this.synth.pending)) this.synth.cancel();
          const u = new SpeechSynthesisUtterance(text);
          const pre = tag.slice(0, 2);
          const voice = this.voices.find((v) => (v.lang || '').replace('_', '-') === tag)
            || this.voices.find((v) => (v.lang || '').toLowerCase().startsWith(pre));
          if (voice) u.voice = voice;
          u.lang = voice ? voice.lang : tag;
          u.rate = rate; u.pitch = pitch; u.volume = volume;
          u.onend = u.onerror = () => resolve();
          this.synth.speak(u);
        } catch (e) { resolve(); }
      });
    },
    stop() {
      if (this.tts) { this.tts.stop().catch(() => {}); return; }
      if (this.synth) { try { this.synth.cancel(); } catch (e) { /* noop */ } }
    },
  };

  /* Єдина точка для будь-якої фрази: записаний файл, якщо він є, інакше
     синтезатор. Повертає false, якщо сказати нічим (тоді — вібро/візуал). */
  /* Російські записи (інший голос) приблизно на 1,7 дБ тихіші за англійські
     й українські — вирівнюємо, щоб голос не губився під шумом */
  const CLIP_LANG_GAIN = { ru: 1.2 };
  function say(key, text, rate, volume, onFail) {
    const path = `${settings.lang}/${key}.mp3`;
    if (Clips.has(path)) {
      Speech.stop();
      Clips.play(path, volume * (CLIP_LANG_GAIN[settings.lang] || 1), onFail);
      return true;
    }
    // записаний голос можна підсилити понад 1, синтезатор — ні
    return Speech.speak(text, settings.lang, rate, Math.min(1, volume), onFail);
  }
  function stopVoice() { Speech.stop(); Clips.stop(); }

  /* ================= 6. Поток А: «Сбросить напряжение» ================= */
  const stagesA = [$('a1'), $('a2'), $('a3'), $('a4')];
  const progressA = Array.from($('a-progress').querySelectorAll('button'));
  const soundOn = () => settings.feedback === 'sound';
  /* Перша версія — без голосових підказок у вправах: їх замінюють звуки
     вдиху, видиху й постукувань. Записи й код лишаються — щоб повернути,
     досить увімкнути цей прапорець (і рядок у налаштуваннях). Голос сну
     (відлік, слова, радіо) від цього не залежить. */
  const VOICE_PROMPTS = false;
  const voiceOn = () => VOICE_PROMPTS && soundOn() && settings.voiceCues;

  /* Голосова команда етапу — лише в режимі «Звук + Вібро» й коли
     користувач не вимкнув голос кнопкою в шапці. */
  function cue(key, text) {
    if (voiceOn()) say(key, text, 0.9, 0.85);
  }
  /* Те саме, але повертає, скільки чекати: не менше minMs і не менше, ніж
     звучить записана фраза (записи читаються повільно, з паузами). */
  async function cueWait(key, text, minMs) {
    cue(key, text);
    const path = `${settings.lang}/${key}.mp3`;
    if (!voiceOn() || !Clips.has(path)) return minMs;
    try { return Math.max(minMs, (await Clips._load(path)).duration * 1000 + 400); } catch (e) { return minMs; }
  }
  /* Динамік у шапці вправи — той самий режим, що й кнопка на головній:
     увімкнений = «Звук + Вібро», вимкнений = «Лише вібро» */
  function paintVoiceButton() {
    const btn = $('a-voice');
    btn.hidden = false;
    btn.setAttribute('aria-pressed', String(soundOn()));
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
    // з голосом — чекаємо, поки дослухають інструкцію; без голосу вправа
    // починається одразу: метелик блимає, а текст можна читати по ходу
    if (voiceOn()) await wait(await cueWait('bfText', tr('bfText'), 5500), t);
    else await wait(600, t);
    for (let set = 0; set < BUTTERFLY_SETS; set++) {
      text.textContent = tr('bfText');
      for (let i = 0; i < BUTTERFLY_TAPS; i++) {
        const side = i % 2; // 0 — ліва, 1 — права
        dots[side].classList.add('on');
        dots[1 - side].classList.remove('on');
        Haptic.play(30); // ритм «дотиків» — коротким легким поштовхом
        if (soundOn()) Sound.tap(side ? 1 : -1); // тихий стук з того боку, де «рука»
        await wait(BUTTERFLY_MS, t);
      }
      clear();
      if (set < BUTTERFLY_SETS - 1) {
        text.textContent = tr('bfPause');
        // пауза на подих: звук повільного вдиху, потім довгого видиху
        if (soundOn() && !voiceOn()) {
          Sound.breathIn(2.8);
          setTimeout(() => { if (!t.cancelled) Sound.breathOut(3.6); }, 3000);
        }
        await wait(await cueWait('bfPause', tr('bfPause'), BUTTERFLY_REST), t);
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
  const BREATH_REST = 0.55;
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
    const label = circle.parentElement.querySelector('.breath__label');
    // коло й напис дихають разом: однаковий масштаб і однаковий час
    const breathTo = (scale, ms) => [circle, label].forEach((el) => {
      el.style.transitionDuration = ms + 'ms';
      el.style.transform = `scale(${scale})`;
    });
    breathTo(BREATH_REST, 0);
    cmd.textContent = tr('ready');
    count.textContent = '';
    await wait(1200, t);

    for (let cycle = 1; cycle <= BREATH_CYCLES; cycle++) {
      count.textContent = `${cycle} / ${BREATH_CYCLES}`;
      for (const phase of BREATH_PHASES) {
        cmd.textContent = tr(phase.text);
        breathTo(phase.scale, phase.ms);
        Haptic.play(phase.vib);
        // з голосом тон стає тихішим тлом, без голосу — основним орієнтиром
        if (soundOn()) {
          // замість слів «вдих / ще трошки / видих» — звук самого дихання;
          // тон-провідник лишається, лише коли живого запису немає
          let live = false;
          if (!voiceOn()) {
            live = phase.text === 'exhale' ? Sound.breathOut(phase.ms / 1000)
              : Sound.breathIn(phase.ms / 1000, phase.text === 'topup' ? 0.7 : 1);
          }
          if (!live) Sound.glide(phase.tone[0], phase.tone[1], phase.ms / 1000, voiceOn() ? 0.035 : 0.045);
        }
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
      if (soundOn()) {
        Sound.softBell(659.25, 0.09, 3.5); // вищий дзвіночок: напружити
      }
      for (let s = 5; s >= 1; s--) { timer.textContent = s; await wait(1000, t); }

      stage.classList.remove('tense');
      text.textContent = tr(release);
      cue(release, tr(release));
      Haptic.play([25, 140, 25]);
      if (soundOn()) {
        Sound.softBell(440, 0.09, 4.5); // нижчий дзвіночок: відпустити
      }
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
  const GROUND_NOTES = [392, 440, 523.25, 587.33, 659.25]; // соль–ля–до–ре–мі

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
    // кожен дотик — тиха нота: по кроку вони йдуть угору м'якою пентатонікою
    if (soundOn()) Sound.bell(GROUND_NOTES[ground.taps % GROUND_NOTES.length], 0.045);
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
  // Новому користувачу — фраза-приклад (її можна змінити чи прибрати);
  // збережений порожній рядок означає «прибрано», і приклад більше не з'являється
  const getAnchor = () => { const v = Store.get('anchorText', null); return (v === null ? tr('anchorExample') : v).trim(); };
  const quoteAnchor = () => { const a = getAnchor(); return a ? `«${a}»` : ''; };
  let anchorReturn = null;
  function openAnchor(returnTo) {
    anchorReturn = returnTo;
    $('anchor-input').value = getAnchor();
    $('anchor-clear').hidden = !getAnchor();
    paintAnchorCount();
    showScreen('s-anchor');
  }
  // лічильник знаків: фраза має вміститися на головній у три рядки
  function paintAnchorCount() {
    const el = $('anchor-input'), max = el.maxLength, n = el.value.length;
    $('anchor-count').textContent = `${n} / ${max}`;
    $('anchor-count').classList.toggle('is-full', n >= max);
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
    const imm = plugin('Immersive'); // у застосунку — власний модуль Android
    if (imm) { imm.enter().catch(() => {}); return; }
    const d = document.documentElement, req = d.requestFullscreen || d.webkitRequestFullscreen;
    if (fsEl() || !req) return;
    try { const p = req.call(d, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => {}); } catch (e) { /* noop */ }
  }
  function exitFullscreen() {
    const imm = plugin('Immersive');
    if (imm) { imm.exit().catch(() => {}); return; }
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
  // Кольори кульки: світло / основний / тінь — м'які, без кислотних
  const KID_COLORS = [['#FFD2BC', '#F29C82', '#B9585A'], ['#D9F0E2', '#8CC4A4', '#4E8468'],
    ['#E6DDFF', '#AFA0E6', '#6E5BAE'], ['#FFE8B8', '#F2C46E', '#B9853A']];
  const kid = { game: Store.get('kidGame', 'balloon') === 'candle' ? 'candle' : 'balloon', color: 0 };

  /* Кроки — крапки замість «1 / 5»: дитині не треба вміти рахувати */
  function kidDots(n) {
    const el = $('kid-count');
    el.innerHTML = '';
    if (!n) { el.removeAttribute('aria-label'); return; }
    for (let i = 1; i <= KID_BREATHS; i++) {
      const s = document.createElement('i');
      if (i < n) s.className = 'done'; else if (i === n) s.className = 'now';
      el.appendChild(s);
    }
    el.setAttribute('aria-label', tr('kidStep').replace('{n}', n).replace('{total}', KID_BREATHS));
  }

  function startKid() {
    const t = newToken();
    Haptic.stop();
    stopVoice();
    const balloon = kid.game === 'balloon';
    // у SVG немає властивості .hidden — перемикаємо сам атрибут
    $('kid-balloon').toggleAttribute('hidden', !balloon);
    $('kid-candle').toggleAttribute('hidden', balloon);
    $('s-kid').classList.toggle('kid-screen--candle', !balloon);
    $('kid-games').querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === kid.game)));
    showScreen('s-kid');
    Wake.on();
    runKid(t);
  }
  async function runKid(t) {
    const stage = $('kid-stage'), text = $('kid-text'), sub = $('kid-sub');
    const balloon = kid.game === 'balloon';
    const keys = balloon ? ['kInB', 'kOutB', 'kDoneB'] : ['kInC', 'kOutC', 'kDoneC'];
    const setBalloon = (scale, ms) => {
      stage.style.setProperty('--kid-dur', ms + 'ms');
      stage.style.setProperty('--kid-s', scale);
    };
    for (;;) {
      stage.classList.remove('fly', 'blow', 'sniff', 'cwave');
      const [c1, c2, c3] = KID_COLORS[kid.color++ % KID_COLORS.length];
      stage.style.setProperty('--kid-c1', c1);
      stage.style.setProperty('--kid-c2', c2);
      stage.style.setProperty('--kid-c3', c3);
      setBalloon(0.35, 0);
      for (let n = 1; n <= KID_BREATHS; n++) {
        kidDots(n);
        text.textContent = tr(keys[0]);
        sub.textContent = balloon ? '' : tr('kSubInC');
        stage.classList.remove('blow');
        stage.classList.add('sniff');
        Haptic.play(35); // лише на зміну дії: «вдих»
        if (soundOn()) {
          if (voiceOn()) Sound.glide(196, 262, KID_IN / 1000, 0.035);
          else Sound.chimes(true, KID_IN / 1000); // дзвіночки вгору
        }
        await wait(await cueWait(keys[0], tr(keys[0]), KID_IN), t);

        text.textContent = tr(keys[1]);
        sub.textContent = balloon ? '' : tr('kSubOutC');
        stage.classList.remove('sniff');
        stage.classList.add('blow');
        setBalloon(0.35 + (0.65 * n) / KID_BREATHS, KID_OUT); // кулька росте з кожним видихом
        Haptic.play([25, 140, 25]); // «видих»
        if (soundOn()) {
          if (voiceOn()) Sound.glide(262, 165, KID_OUT / 1000, 0.035);
          else Sound.chimes(false, KID_OUT / 1000); // дзвіночки вниз
        }
        await wait(await cueWait(keys[1], tr(keys[1]), KID_OUT), t);
      }
      stage.classList.remove('blow');
      kidDots(KID_BREATHS + 1); // усі крапки зафарбовані
      text.textContent = tr(keys[2]);
      stage.classList.add(balloon ? 'fly' : 'cwave');
      sub.textContent = '';
      Haptic.play(30);
      if (soundOn()) { Sound.bell(392, 0.07); setTimeout(() => { if (!t.cancelled) Sound.bell(523.25, 0.07); }, 220); }
      await wait(await cueWait(keys[2], tr(keys[2]), 3600), t);
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
      'клубника', 'малина', 'персик', 'абрикос', 'виноград', 'апельсин', 'банан', 'сыр', 'фиалка', 'каша',
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
  // (−3 дБ від попередніх 0.8 / 0.42: голос у сні мав бути чутним і на «Гучніше»)
  const NOISE_LEVEL = { brown: 0.56, rain: 0.3 };
  /* Дощ шелестить у тих самих частотах, що й мова, і маскує слова сильніше
     за рівний шум — тому під дощ голос трохи гучніший. */
  const VOICE_BOOST = { off: 1, brown: 1, rain: 1.3 };
  const sleepText = $('sleep-text');

  /* ---- Прогрессивное замедление: обратный отсчёт ----
     Чем ближе к нулю, тем длиннее пауза, медленнее и тише голос —
     счёт «растворяется» вместе с вниманием.
     Пауза рахується від КІНЦЯ числа: 1 с тиші (base) плюс надбавка extra.
     Від 100 до 11 надбавка росте лише трохи: 0 → A; на останніх десяти
     пауза помітно довша: 2A → 6A. A підбирає runCountdown під тривалість,
     але не більше COUNT_A_MAX — тож A ≤ 2,5 с, остання пауза ≤ 15 с.
     Гучність і темп тихішають і сповільнюються разом із паузою. */
  const COUNT_A_MAX = 2500;
  function countPace(n, A) {
    if (n > 10) {
      const k = (100 - n) / 89; // 0 на 100 → 1 на 11
      return { base: 1000, extra: A * k, rate: 0.95 - k * 0.15, vol: 1 - k * 0.4 };
    }
    const k = (10 - n) / 10;   // 0 на 10 → 1 на 0
    return { base: 1000, extra: A * (2 + 4 * k), rate: 0.75 - k * 0.05, vol: 0.55 - k * 0.15 };
  }
  // сума надбавок за весь відлік у одиницях A: ≈45 до 11 і 44 на останніх десяти
  const COUNT_A_UNITS = (() => { let s = 0; for (let n = 100; n >= 0; n--) s += countPace(n, 1).extra; return s; })();
  const COUNT_SPEECH_MS = 1500; // приблизна тривалість одного числа вголос

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
    if (sleepVoice()) say(key, String(text), pace.rate, pace.vol * SPEECH_BASE_VOLUME * (VOICE_BOOST[settings.bg] || 1));
  }

  /* Фаза місяця p: 0 — молодий (темний), 0,5 — половина, 1 — повний.
     Освітлена частина справа: півколо + межа світла-тіні (еліпс). */
  let moonTimer = 0;
  function paintMoon(p) {
    const r = 10, rx = (r * Math.abs(1 - 2 * p)).toFixed(2);
    const d = p <= 0.001 ? '' : p >= 0.999
      ? `M0 ${-r}A${r} ${r} 0 1 1 0 ${r}A${r} ${r} 0 1 1 0 ${-r}Z`
      : `M0 ${-r}A${r} ${r} 0 0 1 0 ${r}A${rx} ${r} 0 0 ${p < 0.5 ? 0 : 1} 0 ${-r}Z`;
    $('sleep-time').lastElementChild.setAttribute('d', d);
  }
  function startSleep() {
    const t = newToken();
    stopVoice(); // зразок мови радіо, якщо ще звучить
    showScreen('s-b2');
    sleepText.classList.remove('fade', 'warm');
    setTimeout(() => sleepText.classList.add('warm'), 400); // поступово — в бурштин
    // «Радіо» — ледь освітлений приймач; системний рядок ховаємо в будь-якому режимі
    const radioArt = $('sleep-radio');
    radioArt.classList.remove('fade', 'is-awake');
    // у SVG властивості .hidden немає — лише атрибут
    radioArt.toggleAttribute('hidden', !(settings.sleepMode === 'radio' && radioLang()));
    enterFullscreen();
    sleepText.textContent = '';
    // Місяць росте рівно за обрану тривалість (8/15/25 хв): повний — кінець
    $('sleep-time').classList.remove('fade');
    const moonStart = Date.now(), moonMs = sleepMs();
    paintMoon(0);
    clearInterval(moonTimer);
    moonTimer = setInterval(() => {
      if (t.cancelled || currentScreen !== 's-b2') { clearInterval(moonTimer); return; }
      paintMoon(Math.min(1, (Date.now() - moonStart) / moonMs));
    }, 2000);
    Wake.on();
    if (settings.bg !== 'off') Sound.startNoise(6, NOISE_LEVEL[settings.bg], settings.bg);
    ({ count: runCountdown, words: runWords, radio: runRadio }[settings.sleepMode] || runCountdown)(t);
  }

  /* Тривалість із Налаштувань: під неї підбирається надбавка до паузи. Якщо
     відлік із найдовшими дозволеними паузами закінчиться раніше (15 і 25 хв),
     далі до кінця таймера звучить лише тихий фон. */
  const sleepMs = () => Number(settings.sleepMin) * 60 * 1000;
  async function runCountdown(t) {
    const started = performance.now();
    const fixed = 101 * (1000 + COUNT_SPEECH_MS);
    const A = Math.max(300, Math.min(COUNT_A_MAX, (sleepMs() - fixed) / COUNT_A_UNITS));
    // Записаний відлік (audio/<мова>/n-100…n-1): числа без файлу (0) не
    // озвучуються синтезатором, щоб наприкінці не з'явився чужий голос.
    const recorded = Clips.has(`${settings.lang}/n-1.mp3`);
    for (let n = 100; n >= 0; n--) {
      const pace = countPace(n, A);
      const key = 'n-' + n;
      const clip = sleepVoice() && Clips.has(`${settings.lang}/${key}.mp3`);
      if (recorded && !Clips.has(`${settings.lang}/${key}.mp3`)) {
        sleepText.classList.remove('is-word');
        sleepText.textContent = n;
        if (settings.bg !== 'off') Sound.setNoiseLevel(NOISE_LEVEL[settings.bg] * pace.vol, 2);
      } else sleepTick(key, n, pace, false);
      if (recorded && n > 1) Clips.preload(`${settings.lang}/n-${n - 1}.mp3`);
      // записане число: чекаємо, поки дозвучить (не довше 5 с); синтезатор чи
      // беззвучний режим — приблизна тривалість числа
      if (clip) await Promise.race([Clips.finished, wait(5000, t)]);
      else await wait(COUNT_SPEECH_MS, t);
      if (t.cancelled) return;
      await wait(pace.base + pace.extra, t);
    }
    // відлік скінчився раніше за таймер: число гасне, фон тихо грає до кінця
    const left = sleepMs() - (performance.now() - started);
    if (left > 3000) {
      sleepText.classList.add('fade');
      if (settings.bg !== 'off') Sound.setNoiseLevel(NOISE_LEVEL[settings.bg] * 0.35, 8);
      await wait(left, t);
      if (t.cancelled) return;
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

  /* ---- «Радіо»: монотонне читання незрозумілою мовою ----
     Мозок чує людський голос (поруч хтось є), але не розуміє слів і не
     чіпляється за зміст. Тексти навмисно нейтральні: погода, море, село,
     кухня — жодних новин. Читає синтезатор телефона повільно й нижчим
     голосом, з довгими паузами; голос поступово тихішає. */
  const RADIO_TEXT = {
    es: [
      'Buenas noches. A continuación, el parte meteorológico para mañana.',
      'En el norte de la península, cielos poco nubosos y temperaturas suaves.',
      'En la costa cantábrica, brumas matinales que se disiparán a lo largo de la mañana.',
      'Viento flojo del oeste, rolando a componente sur por la tarde.',
      'En el interior, ambiente tranquilo y temperaturas sin cambios.',
      'En las islas, cielo despejado y mar en calma.',
      'Parte marítimo. Desde el cabo de Finisterre hasta el cabo de Peñas, marejadilla.',
      'Mar de fondo del noroeste de un metro. Visibilidad buena.',
      'En el golfo de Cádiz, viento variable de fuerza dos. Mar rizada.',
      'Las temperaturas mínimas rondarán los doce grados en la meseta.',
      'Para el fin de semana se espera tiempo estable en casi todo el territorio.',
      'En los valles del Pirineo, nieblas en las primeras horas.',
      'El pueblo se encuentra al pie de la sierra, entre campos de olivos y almendros.',
      'Por la mañana, el panadero abre temprano y el olor a pan recién hecho llena la plaza.',
      'Junto al río hay un camino de tierra que lleva hasta el viejo molino.',
      'En otoño, las hojas de los castaños cubren despacio el sendero.',
      'Para la receta de hoy necesitaremos harina, agua templada, un poco de sal y aceite de oliva.',
      'Se mezcla todo con calma y se deja reposar la masa durante una hora.',
      'Mientras tanto, cortamos los tomates en trozos pequeños y los ponemos en un cuenco.',
      'El horno se calienta a fuego medio. No hay prisa.',
      'Se reparte la masa en la bandeja y se cubre con un paño limpio.',
      'Las campanas de la iglesia dan las nueve. La calle está en silencio.',
      'Seguimos con la información del estado de las carreteras. Circulación fluida en todas las vías.',
      'Y ahora, un poco de música tranquila antes de despedirnos.',
    ],
    it: [
      'Buonasera. Ecco le previsioni del tempo per domani.',
      'Al nord, cielo sereno o poco nuvoloso. Temperature stazionarie.',
      'Sulle coste tirreniche, venti deboli e mare poco mosso.',
      'Nelle valli alpine, possibili banchi di nebbia nelle prime ore del mattino.',
      'Al centro, tempo stabile e soleggiato per tutta la giornata.',
      'Bollettino del mare. Mar Ligure: calmo. Visibilità buona.',
      'Il paese si trova su una collina, circondato da vigneti e ulivi.',
      'La mattina, il mercato apre nella piazza principale, accanto alla fontana.',
      'Un sentiero di pietra porta fino alla vecchia chiesa.',
      'Per la ricetta di oggi servono farina, acqua tiepida, sale e un filo d’olio.',
      'Si impasta con calma e si lascia riposare l’impasto per un’ora.',
      'Nel frattempo, tagliamo le zucchine a fette sottili.',
      'Il forno si scalda lentamente. Non c’è fretta.',
      'Le campane suonano le nove. La strada è tranquilla.',
    ],
    pt: [
      'Boa noite. Seguem-se as previsões do tempo para amanhã.',
      'No litoral norte, céu pouco nublado e vento fraco de noroeste.',
      'No interior, tempo estável e temperaturas amenas.',
      'No mar, ondulação de noroeste de um metro. Visibilidade boa.',
      'A aldeia fica junto ao rio, entre campos de milho e oliveiras.',
      'De manhã, a padaria abre cedo e o cheiro a pão espalha-se pela rua.',
      'Para a receita de hoje precisamos de farinha, água morna, sal e azeite.',
      'Mistura-se tudo com calma e deixa-se a massa descansar durante uma hora.',
      'O forno aquece devagar. Não há pressa.',
      'Os sinos da igreja tocam as nove. A rua está em silêncio.',
      'Na costa alentejana, mar chão e vento fraco.',
      'Ao fim da tarde, os pescadores recolhem as redes devagar.',
    ],
    ro: [
      'Bună seara. Urmează prognoza meteo pentru mâine.',
      'În nordul țării, cer variabil și temperaturi plăcute.',
      'La munte, ceață dimineața, apoi cer senin.',
      'Vântul va sufla slab, din direcția vest.',
      'Pe litoral, marea va fi liniștită. Vizibilitate bună.',
      'În câmpie, vreme stabilă pe tot parcursul zilei.',
      'Satul se află la poalele dealului, printre livezi de meri și pruni.',
      'Dimineața, brutarul deschide devreme și mirosul de pâine caldă umple strada.',
      'Pe marginea râului, o potecă duce până la moara veche.',
      'Pentru rețeta de azi avem nevoie de făină, apă călduță, sare și puțin ulei.',
      'Se amestecă totul încet și se lasă aluatul să se odihnească o oră.',
      'Cuptorul se încălzește încet. Nu ne grăbim.',
      'Clopotele bisericii bat ora nouă. Strada este liniștită.',
    ],
  };
  const RADIO_LANGS = [['es', 'es-ES', 'Español'], ['it', 'it-IT', 'Italiano'], ['pt', 'pt-PT', 'Português'], ['ro', 'ro-RO', 'Română']];
  /* Записана передача (audio/radio-<мова>/r-01…): звучить замість синтезатора.
     Число — скільки шматків; перший — вступ «Boa noite…». */
  /* Пункти передачі: скільки шматків у кожному, по порядку номерів файлів.
     pt: ваш запис — пункти 1, 2 і 10 (межі знайдені розпізнаванням мови) +
     пункт 5 голосом Livia; es/it/ro — озвучені
     пункти (es 1,2,3,5,8,10; it 1,2,4,5,7,9,10; ro 1–10). Перший пункт кожної
     мови починається з вітання. Пункт звучить від початку до кінця, лише
     потім випадково обирається наступний — голос міняється тільки між пунктами. */
  const RADIO_SECTIONS = { pt: [5, 6, 5, 5], es: [5, 6, 5, 5, 5, 5], it: [5, 5, 6, 6, 5, 5, 4], ro: [5, 5, 6, 5, 5, 4, 4, 5, 5, 4] };
  const RADIO_REC = Object.fromEntries(Object.entries(RADIO_SECTIONS).map(([k, s]) => [k, s.reduce((a, b) => a + b, 0)]));
  /* Номер першого шматка кожного пункту: [1, 6, 12, …] */
  const radioStarts = (key) => { let n = 1; return RADIO_SECTIONS[key].map((c) => { const s = n; n += c; return s; }); };
  const radioClip = (key, i) => `radio-${key}/r-${String(i).padStart(2, '0')}.mp3`;
  const radioRec = (key) => !!RADIO_REC[key] && Clips.available.has(radioClip(key, 1));
  /* Мови «Радіо», для яких є запис або голос у телефоні: [{key, tag, name}] */
  function radioLangs() {
    const out = [];
    for (const [key, tag, name] of RADIO_LANGS) {
      if (radioRec(key)) { out.push({ key, name, tag, rec: true }); continue; }
      const found = Speech.hasLang(key);
      // перевага — «рідному» варіанту мови (es-ES), інакше той, що є (es-US)
      if (found) out.push({ key, name, tag: found.toLowerCase() === tag.toLowerCase() ? tag : (Speech.hasLang(tag.toLowerCase()) || found) });
    }
    return out;
  }
  /* Обрана мова «Радіо» (або перша наявна); null — жодного голосу немає */
  function radioLang() {
    const list = radioLangs();
    return list.find((l) => l.key === settings.radioLang) || list[0] || null;
  }
  /* ---- Мелодії між пунктами «Радіо» ----
     Коротка тиха заставка (8–11 с), як між блоками новин на старому радіо:
     тихо починається, трохи наростає й стихає. Інструменти синтезуються тут
     же, без файлів; струнні — дуже м'які (щипок згладжений, верхи зрізані).
     У кожної мови свої мелодії, вони чергуються. Обрано за пробою (листопад 2026). */
  const Jingles = {
    live: [],
    cache: new Map(),
    stop() { this.live.forEach((o) => { try { o.stop(); } catch (e) { /* noop */ } }); this.live = []; },
    _osc(type, f, t, end, gain, out) {
      const o = Sound.ctx.createOscillator();
      o.type = type; o.frequency.value = f;
      o.connect(gain).connect(out); o.start(t); o.stop(end);
      this.live.push(o);
      o.onended = () => { const i = this.live.indexOf(o); if (i >= 0) this.live.splice(i, 1); };
      return o;
    },
    inst: {
      celesta(J, c, out, f, t, d, v) {
        [[1, 1], [4, 0.08]].forEach(([m, a]) => {
          const g = c.createGain(), e = t + Math.max(1.2, d * 1.6) / Math.sqrt(m);
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.11 * v * a, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, e);
          J._osc('sine', f * m, t, e + 0.05, g, out);
        });
      },
      box(J, c, out, f, t, d, v) {
        [[1, 1], [3, 0.12], [5.4, 0.03]].forEach(([m, a]) => {
          const g = c.createGain(), e = t + 1.6 / Math.sqrt(m);
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08 * v * a, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, e);
          J._osc('sine', f * m, t, e + 0.05, g, out);
        });
      },
      vibe(J, c, out, f, t, d, v) {
        const g = c.createGain(), e = t + d + 1.8, trem = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09 * v, t + 0.02); g.gain.setTargetAtTime(0.0001, t + 0.05, (d + 1.2) / 3);
        trem.gain.value = 0.75; lfo.frequency.value = 4.2; lg.gain.value = 0.25;
        lfo.connect(lg).connect(trem.gain); lfo.start(t); lfo.stop(e); J.live.push(lfo);
        trem.connect(out);
        J._osc('sine', f, t, e, g, trem);
        const g2 = c.createGain();
        g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(0.012 * v, t + 0.01); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        J._osc('sine', f * 4, t, t + 0.7, g2, trem);
      },
      flute(J, c, out, f, t, d, v) {
        const g = c.createGain(), e = t + d + 0.25, lfo = c.createOscillator(), lg = c.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.07 * v, t + 0.12); g.gain.setValueAtTime(0.07 * v, e - 0.25); g.gain.linearRampToValueAtTime(0.0001, e);
        const o = J._osc('sine', f, t, e + 0.05, g, out);
        lfo.frequency.value = 5; lg.gain.value = f * 0.004; lfo.connect(lg).connect(o.frequency); lfo.start(t); lfo.stop(e + 0.05); J.live.push(lfo);
        const g2 = c.createGain();
        g2.gain.setValueAtTime(0.0001, t); g2.gain.linearRampToValueAtTime(0.008 * v, t + 0.12); g2.gain.linearRampToValueAtTime(0.0001, e);
        J._osc('sine', f * 2, t, e + 0.05, g2, out);
      },
      keys(J, c, out, f, t, d, v) {
        [[1, 1], [2, 0.18], [3, 0.05]].forEach(([m, a]) => {
          const g = c.createGain();
          g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06 * v * a, t + 0.015); g.gain.setTargetAtTime(0.0001, t + 0.03, (d + 0.8) / (2 + m));
          J._osc('sine', f * m, t, t + d + 1.2, g, out);
        });
      },
      pad(J, c, out, f, t, d, v) {
        const g = c.createGain(), e = t + d + 0.8;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.025 * v, t + 0.6); g.gain.setValueAtTime(0.025 * v, t + d); g.gain.linearRampToValueAtTime(0.0001, e);
        [-0.6, 0.6].forEach((dt) => J._osc('sine', f + dt, t, e + 0.05, g, out));
      },
      // щипкова струна, дуже м'яко (Карплус — Стронг); буфери кешуються
      pluck(J, c, out, f, t, d, v, soft = 0.12) {
        const sr = c.sampleRate, len = Math.floor(sr * Math.min(3, d + 1.6)), N = Math.max(2, Math.round(sr / f));
        const key = f.toFixed(1) + '|' + soft + '|' + len;
        let buf = J.cache.get(key);
        if (!buf) {
          buf = c.createBuffer(1, len, sr);
          const y = buf.getChannelData(0);
          for (let i = 0; i < N; i++) y[i] = Math.random() * 2 - 1;
          for (let k = 0; k < 4; k++) for (let i = 1; i < N; i++) y[i] = y[i] * soft + y[i - 1] * (1 - soft);
          for (let i = N; i < len; i++) y[i] = 0.497 * (y[i - N] + y[i - N + 1]);
          J.cache.set(key, buf);
        }
        const s = c.createBufferSource(), g = c.createGain(), lp = c.createBiquadFilter();
        s.buffer = buf; lp.type = 'lowpass'; lp.frequency.value = 1300; lp.Q.value = 0.5;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.13 * v, t + 0.035); g.gain.setTargetAtTime(0.0001, t + d + 0.2, 0.35);
        s.connect(lp).connect(g).connect(out); s.start(t); s.stop(t + len / sr);
        J.live.push(s);
      },
      mando(J, c, out, f, t, d, v) {
        const n = Math.max(2, Math.round(d * 5));
        for (let i = 0; i < n; i++) J.inst.pluck(J, c, out, f, t + i / 5, 0.5, v * (0.55 - 0.25 * i / n) * (i % 2 ? 0.75 : 1), 0.16);
      },
      cimb(J, c, out, f, t, d, v) {
        J.inst.pluck(J, c, out, f, t, d, v * 0.75, 0.16);
        J.inst.pluck(J, c, out, f * 1.002, t + 0.12, d, v * 0.25, 0.16);
      },
    },
    /* Мелодії: [доля, MIDI-нота або акорд, тривалість у долях, інструмент, гучність] */
    LIST: (() => {
      const ch = (b, n, d, i = 'pad', v = 1) => [b, n, d, i, v];
      const arp = (chords, step, dur, inst, vol) => chords.flatMap((c, k) => c.map((n, i) => [k * c.length * step + i * step, n, dur, inst, vol(k, i)]));
      return [
        { bpm: 84, len: 9, gain: 2.8, notes: [[0, 69, 1, 'celesta'], [1, 72, 1, 'celesta'], [2, 77, 1, 'celesta'], [3, 76, 2, 'celesta'], [5, 72, 1, 'celesta'], [6, 74, 1, 'celesta'], [7, 72, 1, 'celesta', 0.9], [8, 69, 1, 'celesta', 0.85], [9, 72, 3, 'celesta', 0.8],
          ch(0, [53, 57, 60], 3), ch(3, [48, 55, 60], 3), ch(6, [46, 53, 58], 3), ch(9, [53, 57, 60], 3)] }, // 0 Вечірній вальс
        { bpm: 72, len: 10, gain: 2.2, notes: [[0, 74, 1, 'flute'], [1, 71, 1.5, 'flute'], [2.5, 67, 0.5, 'flute', 0.9], [3, 69, 1, 'flute'], [4, 71, 1, 'flute'], [5, 74, 1, 'flute'], [6, 76, 1, 'flute'], [7, 74, 1, 'flute', 0.9], [8, 71, 1, 'flute', 0.85], [9, 67, 2.6, 'flute', 0.8],
          ch(0, [55, 59, 62], 4), ch(4, [48, 52, 55], 2), ch(6, [50, 54, 57], 2), ch(8, [55, 59, 62], 4)] }, // 1 Колискова флейти
        { bpm: 66, len: 10, gain: 2.55, notes: [...arp([[62, 66, 69, 73], [59, 62, 66, 69], [55, 59, 62, 66], [57, 61, 64, 69]], 0.5, 1.5, 'vibe', (k) => 0.9 - k * 0.05),
          [8, [62, 66, 69, 74], 3, 'vibe', 0.7], ch(0, [50, 57], 2), ch(2, [47, 54], 2), ch(4, [43, 50], 2), ch(6, [45, 52], 2), ch(8, [50, 57], 3)] }, // 2 Вібрафон біля моря
        { bpm: 100, len: 8.5, gain: 3.6, notes: [[0, 88, 1, 'box'], [1, 86, 1, 'box'], [2, 84, 1, 'box'], [3, 79, 1, 'box'], [4, 81, 1, 'box'], [5, 79, 1, 'box'], [6, 76, 2, 'box'], [8, 77, 1, 'box', 0.9], [9, 76, 1, 'box', 0.9], [10, 74, 1, 'box', 0.85], [11, 79, 1, 'box', 0.85], [12, 84, 2, 'box', 0.8],
          ch(0, [60, 64, 67], 4, 'pad', 0.7), ch(4, [57, 60, 64], 4, 'pad', 0.7), ch(8, [53, 57, 60], 2, 'pad', 0.7), ch(10, [55, 59, 62], 2, 'pad', 0.7), ch(12, [60, 64, 67], 3, 'pad', 0.7)] }, // 3 Музична скринька
        { bpm: 58, len: 10, gain: 2.65, notes: [[0, [53, 57, 60, 64], 2, 'keys'], [2, [52, 55, 59, 62], 2, 'keys'], [4, [50, 53, 57, 60], 2, 'keys', 0.9], [6, [48, 52, 55, 59], 3, 'keys', 0.85],
          [0.5, 77, 1, 'keys', 0.8], [1.5, 76, 0.5, 'keys', 0.7], [2.5, 74, 1, 'keys', 0.8], [4.5, 72, 1, 'keys', 0.75], [6.5, 71, 0.5, 'keys', 0.7], [7, 72, 2, 'keys', 0.7]] }, // 4 Нічні акорди
        { bpm: 92, len: 10.5, gain: 5.8, notes: [...arp([[45, 52, 57, 60, 64, 60, 57, 52], [41, 48, 53, 57, 60, 57, 53, 48], [43, 50, 55, 59, 62, 59, 55, 50]], 0.5, 1.2, 'pluck', (k, i) => (i === 0 ? 1 : 0.7)),
          [12, 48, 3, 'pluck'], [12.25, 52, 3, 'pluck', 0.7], [12.5, 55, 3, 'pluck', 0.7], [12.75, 60, 3, 'pluck', 0.7], [13, 64, 3, 'pluck', 0.75]] }, // 5 Гітарний перебір
        { bpm: 80, len: 10, gain: 6.8, notes: [[0, 71, 1, 'mando'], [1, 74, 1, 'mando'], [2, 79, 2, 'mando'], [4, 76, 1, 'mando'], [5, 74, 1, 'mando'], [6, 72, 2, 'mando', 0.9], [8, 71, 1, 'mando', 0.85], [9, 69, 1, 'mando', 0.8], [10, 67, 2, 'mando', 0.75],
          [0, 43, 2, 'pluck', 0.8], [2, 50, 2, 'pluck', 0.6], [4, 48, 2, 'pluck', 0.8], [6, 52, 2, 'pluck', 0.6], [8, 50, 2, 'pluck', 0.8], [10, 43, 2.5, 'pluck', 0.7]] }, // 6 Мандоліна на терасі
        { bpm: 84, len: 11, gain: 3.3, notes: [[0, 71, 1, 'pluck', 0.9], [1, 69, 1, 'pluck', 0.85], [2, 67, 1, 'pluck', 0.85], [3, 66, 1, 'pluck', 0.85], [4, 64, 2, 'pluck', 0.9], [6, 67, 1, 'pluck', 0.85], [7, 71, 1, 'pluck', 0.85], [8, 69, 1, 'pluck', 0.85], [9, 67, 1, 'pluck', 0.8], [10, 66, 1, 'pluck', 0.8], [11, 62, 1, 'pluck', 0.8], [12, 67, 3, 'pluck', 0.85],
          ch(0, [52, 59, 64], 4, 'pad', 0.8), ch(4, [48, 55, 60], 4, 'pad', 0.8), ch(8, [50, 57, 62], 4, 'pad', 0.8), ch(12, [43, 55, 59, 62], 3, 'pad', 0.8),
          [0, 40, 2, 'pluck', 0.6], [4, 36, 2, 'pluck', 0.6], [8, 38, 2, 'pluck', 0.6], [12, 43, 3, 'pluck', 0.6]] }, // 7 Сутінки над річкою
        { bpm: 76, len: 10, gain: 2.7, notes: [...[62, 65, 69, 72, 74, 72, 69, 65, 67, 70, 74, 77, 74, 70, 67, 65].map((n, i) => [i * 0.5, n, 1, 'cimb', 0.8 - (i % 4) * 0.05]),
          [8, 65, 3, 'cimb', 0.75], [8.15, 69, 3, 'cimb', 0.6], [8.3, 72, 3, 'cimb', 0.6],
          ch(0, [50, 57, 62], 2), ch(2, [53, 57, 60], 2), ch(4, [46, 53, 58], 2), ch(6, [48, 55, 60], 2), ch(8, [53, 57, 60], 3)] }, // 8 Цимбали здалеку
      ];
    })(),
    // по дві мелодії на мову (румунська — три: її передача найдовша)
    BY_LANG: { es: [5, 0], it: [6, 3], pt: [7, 1], ro: [8, 2, 4] },
    turn: {},
    /* Наступна мелодія мови; повертає її тривалість у секундах (0 — нічого) */
    play(lang, level, dryOut) {
      const set = this.BY_LANG[lang];
      if (!Sound.ready || !set) return 0;
      const k = this.turn[lang] = ((this.turn[lang] ?? -1) + 1) % set.length;
      const J = this.LIST[set[k]], c = Sound.ctx, t = c.currentTime, len = J.len, b = 60 / J.bpm;
      // загальна хвиля гучності: тихо → трохи гучніше → стихає
      // gain — вирівнювання: кожна мелодія ~5 дБ тихіша за голос (виміряно, листопад 2026)
      const out = c.createGain(), lv = J.gain * level * (VOICE_BOOST[settings.bg] || 1);
      out.gain.setValueAtTime(0.0001, t);
      out.gain.linearRampToValueAtTime(0.55 * lv, t + 1.2);
      out.gain.linearRampToValueAtTime(0.85 * lv, t + len * 0.45);
      out.gain.linearRampToValueAtTime(0.5 * lv, t + len * 0.8);
      out.gain.linearRampToValueAtTime(0.0001, t + len + 1.8);
      out.connect(dryOut || Sound._voice()); out.connect(Sound._echoIn());
      const t0 = t + 0.3; // запас: буфери струн готуються наперед
      J.notes.forEach(([beat, m, dur, inst, v = 1]) => [].concat(m).forEach((n) =>
        this.inst[inst](this, c, out, 440 * Math.pow(2, (n - 69) / 12), t0 + beat * b, dur * b, v)));
      return len + 1.8;
    },
  };

  /* ---- Шкала налаштування «Радіо» ----
     Кожна мова — «станція» на своєму місці шкали (місто). Тягнеш шкалу —
     стрілка їде, між станціями шипить ефір, біля станції голос
     пробивається з перебоями. Відпустив — стрілка сама м'яко доходить до
     найближчої станції (щоб не заснути під шипіння). Станцію спіймано —
     легенька вібрація. Обрана станція = мова радіо в налаштуваннях. */
  const Tuner = {
    SLOT: { es: 16, it: 39, pt: 62, ro: 84 },
    on: false, pos: 62, key: null, sig: 1, list: [], mid: false, buzzed: null,
    drag: null, anim: 0, idleTimer: 0, gapI: Math.floor(Math.random() * 5), inGap: false,
    switched: Promise.resolve(), _fire: () => {},
    _signal() { this._fire(); this.switched = new Promise((r) => { this._fire = r; }); },
    start() {
      this.list = radioLangs();
      const cur = radioLang();
      this.on = true; this.key = cur ? cur.key : null; this.buzzed = this.key;
      this.pos = cur ? this.SLOT[cur.key] : 50; this.sig = 1; this.mid = false;
      this._signal();
      document.querySelectorAll('#sr-dial .sr-city').forEach((el) => {
        el.hidden = !this.list.some((l) => l.key === el.dataset.key);
      });
      this._audio();
      this._paint();
      this.wake(4000);
    },
    stop(fade = 0.6) {
      Jingles.stop();
      this.on = false; this.drag = null;
      clearTimeout(this.anim); clearTimeout(this.idleTimer);
      const a = this.au; this.au = null;
      if (a) {
        const now = Sound.ctx.currentTime;
        a.stat.gain.setTargetAtTime(0.0001, now, fade / 4);
        a.whis.gain.setTargetAtTime(0.0001, now, fade / 4);
        a.crk.gain.setTargetAtTime(0.0001, now, fade / 4);
        setTimeout(() => { try { a.src.stop(); a.csrc.stop(); a.osc.stop(); a.osc2.stop(); a.bus.disconnect(); a.stat.disconnect(); a.crk.disconnect(); a.whis.disconnect(); } catch (e) { /* noop */ } }, fade * 1000 + 300);
      }
    },
    current() { return this.on && this.key && this.sig > 0.45 ? this.list.find((l) => l.key === this.key) || null : null; },
    /* Звук ефіру: шипіння з тріском і тихий «свист» біля станції */
    _audio() {
      if (!Sound.ready) return;
      const c = Sound.ctx, out = Sound._voice();
      const sr = c.sampleRate;
      if (!this._staticBuf) {
        // шипіння ефіру з повільним «диханням»
        const n = sr * 3, b = c.createBuffer(1, n, sr), d = b.getChannelData(0);
        for (let i = 0; i < n; i++) {
          const wob = 0.65 + 0.35 * Math.sin((i / sr) * Math.PI * 2 * 2.7);
          d[i] = (Math.random() * 2 - 1) * 0.45 * wob;
        }
        this._staticBuf = b;
        // потріскування: поодинокі клацання і короткі гроноподібні серії
        const m = sr * 4, cb = c.createBuffer(1, m, sr), q = cb.getChannelData(0);
        let crack = 0, burst = 0;
        for (let i = 0; i < m; i++) {
          if (burst > 0) burst--;
          if (Math.random() < 0.00005) burst = Math.floor(sr * (0.04 + Math.random() * 0.12));
          if (Math.random() < (burst > 0 ? 0.004 : 0.00025)) crack = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.5);
          crack *= 0.94;
          q[i] = crack * (0.6 + Math.random() * 0.4);
        }
        this._crackBuf = cb;
      }
      const bus = c.createGain(); bus.gain.value = 1; bus.connect(out);
      const src = c.createBufferSource(); src.buffer = this._staticBuf; src.loop = true;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 350;
      const bp = c.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = 3200; bp.Q.value = 0.4;
      const stat = c.createGain(); stat.gain.value = 0.0001;
      src.connect(hp).connect(bp).connect(stat).connect(out);
      const csrc = c.createBufferSource(); csrc.buffer = this._crackBuf; csrc.loop = true;
      const cbp = c.createBiquadFilter(); cbp.type = 'bandpass'; cbp.frequency.value = 1800; cbp.Q.value = 0.5;
      const crk = c.createGain(); crk.gain.value = 0.0001;
      csrc.connect(cbp).connect(crk).connect(out);
      // «уууУУУууу» налаштування: два ледь розстроєні тони, висота залежить
      // від того, наскільки далеко станція, і плаває, поки крутять шкалу
      // низько й глухо, як гудіння за стіною: на ніч нічого пронизливого
      const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = 110;
      // другий тон — трикутний: його м'які обертони роблять гудіння чутним
      // і в маленькому динаміку телефона, а фільтр зрізає все дзвінке
      const osc2 = c.createOscillator(); osc2.type = 'triangle'; osc2.frequency.value = 111;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.5;
      const whis = c.createGain(); whis.gain.value = 0.0001;
      const g2 = c.createGain(); g2.gain.value = 0.5;
      osc.connect(lp); osc2.connect(g2).connect(lp); lp.connect(whis).connect(out);
      src.start(); csrc.start(); osc.start(); osc2.start();
      this.au = { bus, src, csrc, stat, crk, osc, osc2, whis, move: 0, lastPos: this.pos };
    },
    nearest() {
      let best = null, d = 1e9;
      for (const l of this.list) { const dd = Math.abs(this.SLOT[l.key] - this.pos); if (dd < d) { d = dd; best = l; } }
      return { best, d };
    },
    /* Нове положення стрілки → сила сигналу, звук, перемикання станції */
    _update() {
      const { best, d } = this.nearest();
      this.sig = best ? Math.max(0, 1 - d / 7) : 0;
      const s = this.sig, a = this.au;
      if (a) {
        const now = Sound.ctx.currentTime;
        // перебої: поки хвиля не налаштована, голос то пропадає, то повертається
        const drop = s < 0.97 && Math.random() < (1 - s) * 0.55;
        a.bus.gain.setTargetAtTime(drop ? s * 0.12 : s * s, now, 0.02);
        a.stat.gain.setTargetAtTime(0.0001 + 0.055 * Math.pow(1 - s, 1.2) * (drop ? 1.5 : 1), now, 0.03);
        // тріск — найбільше, поки хвиля «ловиться» і губиться
        a.crk.gain.setTargetAtTime(s > 0.97 ? 0.0001 : 0.16 * (0.45 + 0.55 * Math.sin(Math.PI * Math.min(1, s * 1.1))), now, 0.04);
        // тон звучить, поки шкала рухається, і стихає, коли вона стоїть
        const mv = Math.min(1, Math.abs(this.pos - a.lastPos) * 1.5);
        a.lastPos = this.pos;
        a.move = Math.max(mv, a.move * 0.9);
        const tone = s > 0.95 ? 0 : (0.35 + 0.65 * a.move) * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, 0.15 + s)));
        a.whis.gain.setTargetAtTime(0.0001 + 0.035 * tone, now, 0.15);
        // ~90…220 Гц: ближче до станції — нижче; плавно, без різких стрибків
        const f = 95 + Math.min(d, 12) * 10 + Math.sin(this.pos * 0.9) * 12;
        a.osc.frequency.setTargetAtTime(f, now, 0.15);
        a.osc2.frequency.setTargetAtTime(f * 1.008 + 0.8, now, 0.18);
      }
      if (best && s > 0.5 && best.key !== this.key) {
        this.key = best.key; this.mid = true;
        settings.radioLang = best.key; Store.set('radioLang', best.key);
        stopVoice(); Jingles.stop(); this._signal();
        paintRadioLangs();
      } else if (s < 0.2 && this.key) {
        this.key = null; stopVoice(); Jingles.stop(); this._signal();
      }
      if (best && s > 0.85 && this.buzzed !== best.key) { this.buzzed = best.key; Haptic.play(14); }
      if (s < 0.3) this.buzzed = null;
      this._paint();
    },
    _paint() {
      const root = $('sleep-radio');
      root.style.setProperty('--sig', this.sig.toFixed(2));
      $('sr-needle').style.left = this.pos + '%';
      $('sr-knob').style.transform = `rotate(${Math.round(-130 + this.pos * 2.6)}deg)`;
      const lit = Math.round(this.sig * 5);
      $('sr-bars').querySelectorAll('i').forEach((el, i) => el.classList.toggle('on', i < lit));
      const { best } = this.nearest();
      const caught = best && this.sig > 0.45;
      document.querySelectorAll('#sr-dial .sr-city').forEach((el) => el.classList.toggle('is-on', !!caught && el.dataset.key === best.key));
      const freq = (87.5 + this.pos * 0.205).toFixed(1);
      const gaps = tr('radioGap').split('|');
      if (!caught && !this.inGap) this.gapI = (this.gapI + 1) % gaps.length; // щоразу інша фраза
      this.inGap = !caught;
      const label = caught ? `${best.name} · ${freq}` : gaps[this.gapI % gaps.length];
      const st = $('sr-station');
      if (st.textContent !== label) st.textContent = label;
      const dial = $('sr-dial');
      dial.setAttribute('aria-valuenow', Math.round(this.pos));
      dial.setAttribute('aria-valuetext', label);
    },
    /* Яскравіше, поки шкалу чіпають; за кілька секунд — знову ледь жевріє */
    wake(ms = 6000) {
      const root = $('sleep-radio');
      root.classList.add('is-awake');
      clearTimeout(this.idleTimer);
      this.idleTimer = setTimeout(() => { if (!this.drag) root.classList.remove('is-awake'); }, ms);
    },
    /* Відпустили — стрілка доходить до найближчої станції */
    snap() {
      const { best } = this.nearest();
      if (!best) return;
      const from = this.pos, to = this.SLOT[best.key], dist = Math.abs(to - from);
      if (dist < 0.2) { this.pos = to; this._update(); return; }
      // повільно, як рука, що обережно докручує ручку
      const dur = Math.min(4200, 1400 + dist * 160), t0 = performance.now();
      clearTimeout(this.anim);
      const step = (now) => {
        if (!this.on || this.drag) return;
        const k = Math.min(1, (now - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        this.pos = from + (to - from) * e;
        this._update();
        if (k < 1) this.anim = setTimeout(() => step(performance.now()), 33);
      };
      this.anim = setTimeout(() => step(performance.now()), 33);
    },
    moveTo(pos) { this.pos = Math.min(97, Math.max(3, pos)); this._update(); },
    bind() {
      const dial = $('sr-dial');
      dial.addEventListener('pointerdown', (e) => {
        if (!this.on) return;
        // шкала — не вихід: утримання пальця тут не закриває сон
        e.stopPropagation(); e.preventDefault(); holdCancel();
        clearTimeout(this.anim);
        try { dial.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
        this.drag = { x: e.clientX, pos: this.pos, w: dial.getBoundingClientRect().width };
        this.wake();
      });
      dial.addEventListener('pointermove', (e) => {
        if (!this.drag) return;
        e.stopPropagation();
        this.moveTo(this.drag.pos + ((e.clientX - this.drag.x) / this.drag.w) * 100);
        this.wake();
      });
      const end = (e) => {
        if (!this.drag) return;
        e.stopPropagation();
        this.drag = null; this.snap(); this.wake();
      };
      dial.addEventListener('pointerup', end);
      dial.addEventListener('pointercancel', end);
      dial.addEventListener('keydown', (e) => {
        if (!this.on || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
        e.preventDefault();
        const dir = e.key === 'ArrowRight' ? 1 : -1;
        const slots = this.list.map((l) => this.SLOT[l.key]).sort((a, b) => a - b);
        const next = dir > 0 ? slots.find((x) => x > this.pos + 0.5) : slots.reverse().find((x) => x < this.pos - 0.5);
        if (next == null) return;
        this.wake();
        // повз шипіння до сусідньої станції
        this.drag = null; this.pos = next - dir * 9; this._update(); this.snap();
      });
    },
  };

  /* «Радіо»: одна передача для запису й для голосу телефону. Звучить
     станція, на якій стоїть шкала; перемикання обриває фразу, а нова
     станція починається з середини — ніби передача вже йшла. */
  async function runRadio(t) {
    if (!radioLang()) { runCountdown(t); return; }
    sleepText.classList.remove('is-word');
    sleepText.textContent = '';
    Tuner.start();
    const started = performance.now();
    const bags = {}, prog = {}; // bags — фрази голосу телефону, prog — де ми в записаній передачі
    const first = Tuner.current();
    if (first && first.rec) Clips.preload(radioClip(first.key, 1));
    await wait(2500, t);
    for (;;) {
      const p = Math.min(1, (performance.now() - started) / sleepMs());
      if (p >= 1 || t.cancelled) break;
      if (settings.bg !== 'off') Sound.setNoiseLevel(NOISE_LEVEL[settings.bg] * (1 - p * 0.6), 2);
      const rl = Tuner.current(), sig = Tuner.switched;
      if (!rl) { await Promise.race([sig, wait(1500, t)]); if (t.cancelled) return; continue; }
      const mid = Tuner.mid; Tuner.mid = false;
      const rec = rl.rec && Sound.ready;
      let between = true; // пауза як між пунктами чи як між реченнями
      if (rec) {
        // пункт звучить повністю, шматок за шматком; наступний пункт — випадковий
        // (усі пункти по разу, потім нове коло). Першим — пункт із вітанням.
        const secs = RADIO_SECTIONS[rl.key], starts = radioStarts(rl.key);
        const st = prog[rl.key] || (prog[rl.key] = { bag: [], next: 1, end: 0, last: -1, started: false });
        if (mid || st.next > st.end) {
          if (!st.bag.length) {
            st.bag = secs.map((_, i) => i).sort(() => Math.random() - 0.5);
            if (st.bag.length > 1 && st.bag[st.bag.length - 1] === st.last) st.bag.unshift(st.bag.pop());
            if (!st.started && !mid) { st.bag = st.bag.filter((i) => i !== 0); st.bag.push(0); } // pop(): вітання першим
          }
          const s = st.bag.pop();
          st.last = s; st.next = starts[s]; st.end = starts[s] + secs[s] - 1;
          // зловили станцію шкалою — передача вже йде: з довільного шматка цього пункту
          if (mid) st.next += Math.floor(Math.random() * secs[s]);
        }
        st.started = true;
        const i = st.next++;
        between = st.next > st.end;
        const vol = (1 - p * 0.6) * SPEECH_BASE_VOLUME * (VOICE_BOOST[settings.bg] || 1);
        Clips.play(radioClip(rl.key, i), vol, null, { bus: Tuner.au && Tuner.au.bus, mid });
        if (!between) Clips.preload(radioClip(rl.key, st.next));
        await Promise.race([Clips.finished, wait(40000, t), sig]);
      } else {
        const list = RADIO_TEXT[rl.key];
        if (!bags[rl.key] || !bags[rl.key].length) bags[rl.key] = list.map((_, i) => i).sort(() => Math.random() - 0.5);
        let line = list[bags[rl.key].pop()];
        if (mid) { // з середини речення
          const w = line.split(' ');
          if (w.length > 4) line = w.slice(1 + Math.floor(Math.random() * (w.length / 2))).join(' ');
        }
        const vol = (1 - p * 0.6) * SPEECH_BASE_VOLUME;
        // чекаємо кінця фрази (з запасом, якщо синтезатор не повідомить)
        await Promise.race([
          Speech.speakForeign(line, rl.tag, 0.82 - p * 0.12, vol),
          new Promise((r) => setTimeout(r, 25000)),
          sig,
        ]);
      }
      if (t.cancelled) return;
      if (Tuner.switched !== sig) continue; // станцію перемкнули — одразу далі
      if (rec && between) {
        // між пунктами — коротка тиша, тиха мелодія-заставка, і далі наступний пункт
        await Promise.race([wait(800 + Math.random() * 500, t), sig]);
        if (t.cancelled) return;
        if (Tuner.switched === sig) {
          const jl = Jingles.play(rl.key, 1 - p * 0.6, Tuner.au && Tuner.au.bus);
          await Promise.race([wait(Math.max(0, jl * 1000 - 600) + p * 1500, t), sig]);
          if (t.cancelled) return;
        }
      } else {
        // усередині пункту — як між реченнями; голос телефону — так само
        const gap = !rec ? 120 + Math.random() * 160 + p * 500 : 250 + Math.random() * 300 + p * 400;
        await Promise.race([wait(gap, t), sig]);
        if (t.cancelled) return;
      }
    }
    endSleep(t);
  }

  /* Автоотключение: текст гаснет, шум затухает за 10 секунд, затем полная
     тишина и снятие Wake Lock — телефон может погасить экран сам. */
  async function endSleep(t) {
    sleepText.classList.add('fade');
    Tuner.stop(2);
    $('sleep-radio').classList.add('fade');
    clearInterval(moonTimer); paintMoon(1); // повний місяць — читання завершене
    $('sleep-time').classList.add('fade');
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
  /* Світла тема: ті самі відтінки, але глибші — щоб світилися на бежевому */
  const isLight = () => settings.theme === 'dawn';
  const L = (l) => (isLight() ? l - 24 : l);
  const SCENE_INK = {
    dark: { rain: 'rgba(150, 172, 160, 0.26)', trail: 'rgba(160, 182, 170, 0.07)', drop: 'rgba(165, 188, 176, 0.16)', rim: 'rgba(190, 206, 196, 0.3)' },
    light: { rain: 'rgba(78, 104, 90, 0.32)', trail: 'rgba(90, 115, 100, 0.09)', drop: 'rgba(95, 120, 105, 0.14)', rim: 'rgba(70, 95, 82, 0.38)' },
  };
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
        ctx.strokeStyle = `hsla(${s.hue}, 45%, ${L(64)}%,${alpha * strength})`;
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
  // Від «до» першої октави (262 Гц): нижчі ноти динамік телефона майже не відтворює
  const GARDEN_NOTES = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
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
    if (soundOn()) Sound.chime(GARDEN_NOTES[index]);
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
      ctx.strokeStyle = `hsla(${r.hue}, 45%, ${L(64)}%,${fade * 0.55})`;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(r.x, r.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${r.hue}, 45%, ${L(64)}%,${fade * fade * 0.7})`;
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
     Три спокійні сцени перемикає лише сам користувач — кнопкою внизу,
     з плавним перетіканням: дощ, краплі на склі, хвилі. У режимі
     «Звук + Вібро» кожна має свій тихий звук. Кольори — сіро-зелені,
     без синього. */
  const SCENES = ['rain', 'glass', 'waves'];
  const SCENE_KEYS = { rain: 'scRain', glass: 'scGlass', waves: 'scWaves' };
  const SCENE_FADE = 2500;
  const scene = { i: 0, prev: -1, since: 0, rain: [], glass: [] };

  /* ---- Краплі на склі ----
     Скло перед нічним вікном: за ним розмиті вогні (боке), на склі — дрібний
     туман і краплі-лінзи (темніший верх, світлий низ, відблиск, тінь).
     Краплі поволі набрякають; важка крапля скочується до самого низу,
     лишаючи мокрий слід, і зливається з кожною краплею на шляху в одну
     більшу (площі складаються). Дотик до краплі — вона теж починає стікати. */
  const GLASS_N = 36;
  const glass = { bg: null, key: '', drops: [], trails: [] };
  const GLASS_TINTS = { dark: ['255,190,120', '255,214,160', '160,200,230', '255,160,110', '150,210,190'],
    light: ['255,200,140', '170,195,215', '255,225,185'] };

  function newGlassDrop(w, h, anywhere) {
    const tints = GLASS_TINTS[isLight() ? 'light' : 'dark'];
    return { x: 6 + Math.random() * (w - 12), y: Math.random() * h * (anywhere ? 0.92 : 0.55),
      r: 1.4 + Math.random() * (anywhere ? 5 : 2.5), grow: 0.05 + Math.random() * 0.22, limit: 6.5 + Math.random() * 4,
      moving: false, vy: 0, ph: Math.random() * 6, trail: [], dead: false,
      tint: tints[Math.floor(Math.random() * tints.length)] };
  }
  /* Фон скла малюється один раз (і при зміні розміру чи теми) в окреме полотно */
  function glassBackdrop(w, h) {
    const light = isLight(), key = `${w}x${h}:${light}`;
    if (glass.key === key) return glass.bg;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr));
    const g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = g.createLinearGradient(0, 0, 0, h);
    if (light) { sky.addColorStop(0, '#C5CDD3'); sky.addColorStop(1, '#D6CCBF'); }
    else { sky.addColorStop(0, '#0E1726'); sky.addColorStop(0.5, '#142033'); sky.addColorStop(1, '#1B1E26'); }
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    const tints = GLASS_TINTS[light ? 'light' : 'dark'];
    for (let i = 0; i < 14; i++) { // вогні за склом, розмиті
      const x = Math.random() * w, y = Math.random() * h, r = 30 + Math.random() * 80;
      const a = (light ? 0.22 : 0.32) + Math.random() * 0.18, col = tints[i % tints.length];
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `rgba(${col},${a})`);
      rg.addColorStop(0.6, `rgba(${col},${a * 0.45})`);
      rg.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = rg;
      g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    g.fillStyle = light ? 'rgba(255,255,255,.14)' : 'rgba(200,215,235,.05)'; // запітніле скло
    g.fillRect(0, 0, w, h);
    const mist = Math.round((w * h) / 2400);
    for (let i = 0; i < mist; i++) { // дрібні краплинки туману
      const x = Math.random() * w, y = Math.random() * h, r = 0.6 + Math.random() * 1.4;
      g.beginPath(); g.arc(x, y + 0.7, r, 0, Math.PI * 2); g.fillStyle = 'rgba(0,0,0,.22)'; g.fill();
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = light ? 'rgba(255,255,255,.5)' : 'rgba(225,235,248,.26)'; g.fill();
    }
    glass.bg = c; glass.key = key;
    return c;
  }
  function glassSlide(d) { if (!d.moving) { d.moving = true; d.vy = 8; d.trail = [{ x: d.x, y: d.y }]; } }
  function glassStep(dt, w, h) {
    const D = glass.drops;
    for (const d of D) {
      if (!d.moving) {
        d.r += d.grow * dt;
        if (d.r > d.limit) glassSlide(d);
        continue;
      }
      // більша крапля важча — котиться швидше; легке «петляння» по склу
      d.vy = Math.min(30 + d.r * 10, d.vy + (14 + d.r * 4) * dt);
      d.y += d.vy * dt;
      d.x += Math.sin(d.y / 26 + d.ph) * 6 * dt;
      const last = d.trail[d.trail.length - 1];
      if (Math.hypot(d.x - last.x, d.y - last.y) > 4) d.trail.push({ x: d.x, y: d.y });
    }
    // крапля, що котиться, вбирає всі краплі, яких торкнулася
    for (const a of D) {
      if (!a.moving || a.dead) continue;
      for (const b of D) {
        if (b === a || b.dead) continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) > (a.r + b.r) * 0.9) continue;
        const ma = a.r * a.r, mb = b.r * b.r;
        a.x = (a.x * ma + b.x * mb) / (ma + mb);
        a.r = Math.sqrt(ma + mb);
        a.vy = Math.max(a.vy, b.vy) * 0.8; // мить затримки на злитті
        b.dead = true;
        if (b.trail.length > 1) glass.trails.push({ pts: b.trail, w: Math.max(1.4, b.r * 0.55), age: 0 });
      }
    }
    for (let i = 0; i < D.length; i++) {
      const d = D[i];
      if (d.dead || d.y - d.r * 2 > h) {
        if (!d.dead && d.trail.length > 1) glass.trails.push({ pts: d.trail, w: Math.max(1.4, d.r * 0.55), age: 0 });
        D[i] = newGlassDrop(w, h, false);
      }
    }
    for (const t of glass.trails) t.age += dt;
    while (glass.trails.length && glass.trails[0].age > 9) glass.trails.shift();
  }
  function drawGlassTrail(ctx, pts, width, fade, light) {
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.lineWidth = width;
    ctx.strokeStyle = light ? `rgba(255,255,255,${0.3 * fade})` : `rgba(205,220,238,${0.1 * fade})`;
    ctx.stroke();
    ctx.lineWidth = Math.max(0.6, width * 0.25);
    ctx.strokeStyle = `rgba(0,0,0,${(light ? 0.08 : 0.18) * fade})`;
    ctx.stroke();
  }
  function drawGlassDrop(ctx, d, light) {
    const rx = d.r, ry = d.r * (d.moving ? Math.min(1.35, 1.05 + d.vy / 300) : 1.06), x = d.x, y = d.y;
    ctx.beginPath(); // тінь на склі
    ctx.ellipse(x + rx * 0.1, y + ry * 0.3, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = light ? 'rgba(40,45,55,.16)' : 'rgba(0,0,0,.36)';
    ctx.fill();
    const g = ctx.createRadialGradient(x, y + ry * 0.45, ry * 0.1, x, y, ry * 1.05); // лінза: світлий низ
    g.addColorStop(0, `rgba(${d.tint},${light ? 0.55 : 0.62})`);
    g.addColorStop(0.55, `rgba(${d.tint},0.12)`);
    g.addColorStop(1, light ? 'rgba(70,80,92,.32)' : 'rgba(5,8,14,.62)');
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.beginPath(); // світла кромка знизу
    ctx.ellipse(x, y, rx * 0.84, ry * 0.84, 0, Math.PI * 0.18, Math.PI * 0.82);
    ctx.lineWidth = Math.max(0.7, rx * 0.15);
    ctx.strokeStyle = 'rgba(240,245,255,.35)';
    ctx.stroke();
    ctx.beginPath(); // відблиск
    ctx.ellipse(x - rx * 0.3, y - ry * 0.38, Math.max(0.7, rx * 0.22), Math.max(0.5, rx * 0.14), -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fill();
  }
  function glassTap(p) {
    let best = null, bestD = 28;
    for (const d of glass.drops) {
      const dist = Math.hypot(p.x - d.x, p.y - d.y) - d.r;
      if (dist < bestD) { best = d; bestD = dist; }
    }
    if (!best) return false;
    if (best.r < 4) best.r = 4 + Math.random() * 2; // дрібна крапля сама не скотиться
    glassSlide(best);
    Haptic.play(12);
    return true;
  }
  const glassWeight = (now) => {
    const k = Math.min(1, (now - scene.since) / SCENE_FADE);
    return (SCENES[scene.i] === 'glass' ? (scene.prev >= 0 ? k : 1) : 0)
      + (scene.prev >= 0 && SCENES[scene.prev] === 'glass' && k < 1 ? 1 - k : 0);
  };
  function initScenes() {
    const { h } = bubbles.view;
    scene.rain = Array.from({ length: 70 }, () => ({
      x: Math.random() * 1.15, y: Math.random() * h, len: 14 + Math.random() * 16, v: 260 + Math.random() * 160,
    }));
    const { w } = bubbles.view;
    glass.drops = Array.from({ length: GLASS_N }, () => newGlassDrop(w, h, true));
    glass.trails = [];
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
    const ink = isLight() ? SCENE_INK.light : SCENE_INK.dark;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = 'round';
    if (name === 'rain') {
      ctx.strokeStyle = ink.rain;
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
      const light = isLight();
      glassStep(dt, w, h);
      ctx.drawImage(glassBackdrop(w, h), 0, 0, w, h);
      for (const t of glass.trails) drawGlassTrail(ctx, t.pts, t.w, 1 - t.age / 9, light);
      for (const d of glass.drops) if (d.moving) drawGlassTrail(ctx, d.trail, Math.max(1.4, d.r * 0.55), 1, light);
      for (const d of glass.drops) drawGlassDrop(ctx, d, light);
    } else {
      drawSea(ctx, w, h, dt, now);
    }
    ctx.restore();
  }

  /* ---- Хвилі: тихе нічне море ----
     Сутінкове небо, місяць і його доріжка на воді, дальні хвилі. Дотик до
     води пускає лише ледь помітну брижу й кола, що повільно розходяться, —
     без сплесків і різких звуків. Місяць і зорі можна пересувати пальцем;
     місячна доріжка йде слідом за місяцем. */
  const sea = { step: 6, cols: 0, y: null, v: null, rings: [], stars: [], drag: null, moon: { x: 0.7, y: 0.17 } };
  function seaInit(w, h) {
    sea.cols = Math.ceil(w / sea.step) + 2;
    sea.y = new Float32Array(sea.cols);
    sea.v = new Float32Array(sea.cols);
    sea.rings = [];
    // більшість зірок дрібні, кожна п'ята — велика, з м'яким сяйвом
    if (!sea.stars.length) sea.stars = Array.from({ length: 44 }, (_, i) => ({
      x: Math.random(), y: Math.random() * 0.36, ph: Math.random() * 6,
      sp: 900 + Math.random() * 1800, // у кожної зірки свій ритм мерехтіння
      r: i % 5 === 0 ? 1.7 + Math.random() * 1.1 : 0.5 + Math.random() * 1.1,
    }));
    sea.w = w; sea.h = h;
  }
  const seaHorizon = (h) => h * 0.42;
  const seaMoonR = (w, h) => Math.min(w, h) * 0.045;
  const seaBase = (h) => h * 0.6;
  const seaSwell = (x, now) => Math.sin(x / 120 + now / 1500) * 7 + Math.sin(x / 47 - now / 2300) * 2.5;
  function seaSurface(i, now) {
    return seaBase(sea.h) + seaSwell(i * sea.step, now) + sea.y[Math.max(0, Math.min(sea.cols - 1, i))];
  }
  function seaStep(dt) {
    // м'яка вода: повільні хвилі, сильне згасання, висота брижі — кілька пікселів
    const K = 420, S = 6, D = 2.2, n = sea.cols, y = sea.y, v = sea.v;
    const steps = Math.max(1, Math.ceil(dt / 0.008)), h = dt / steps;
    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < n; i++) {
        const l = y[i > 0 ? i - 1 : 0], r = y[i < n - 1 ? i + 1 : n - 1];
        v[i] += (K * (l + r - 2 * y[i]) - S * y[i] - D * v[i]) * h;
      }
      for (let i = 0; i < n; i++) y[i] = Math.max(-6, Math.min(6, y[i] + v[i] * h));
    }
    for (const r of sea.rings) r.age += dt;
    sea.rings = sea.rings.filter((r) => r.age < r.life);
    seaDrift(dt);
  }
  /* Небо саме повільно пливе зліва направо: місяць — пологою дугою
     (вище посередині), зорі — ще повільніше. Те, що тримають пальцем,
     стоїть; відпустили — пливе далі з нового місця. */
  function seaDrift(dt) {
    const d = sea.drag, m = sea.moon;
    if (!d || d.kind !== 'moon') {
      m.x += dt * 0.0042;
      m.y = Math.max(0.05, Math.min(0.5, m.y + dt * (m.x - 0.5) * 0.004));
      if (m.x > 1.12) m.x = -0.12; // зайшов за край — виходить з іншого (дуга симетрична, висота та сама)
    }
    for (const s of sea.stars) {
      if (d && d.star === s) continue;
      s.x += dt * 0.0016;
      if (s.x > 1.01) s.x -= 1.02;
    }
  }
  /* Поштовх води біля x: plus — униз (сплеск), minus — угору */
  function seaPush(x, amount, spread = 4) {
    const c = Math.round(x / sea.step);
    for (let j = -spread * 2; j <= spread * 2; j++) {
      const i = c + j;
      if (i < 0 || i >= sea.cols) continue;
      sea.v[i] += amount * Math.exp(-(j * j) / (2 * spread * spread));
    }
  }
  /* Тихі кола на воді в точці дотику (у перспективі — сплющені еліпси) */
  function seaRing(p, strength = 1) {
    if (sea.rings.length > 24) sea.rings.shift();
    sea.rings.push({ x: p.x, y: p.y, age: 0, life: 2.6 + strength, k: strength });
  }
  /* Дотик: місяць чи зірку — бере, щоб пересунути; воду — ледь колише */
  function seaTouch(p) {
    if (!sea.y) return;
    const { w, h } = bubbles.view, hy = seaHorizon(h), mr = seaMoonR(w, h);
    if (Math.hypot(p.x - sea.moon.x * w, p.y - sea.moon.y * h) < mr * 2.6) {
      sea.drag = { kind: 'moon', dx: sea.moon.x * w - p.x, dy: sea.moon.y * h - p.y };
      return;
    }
    if (p.y < hy) {
      let best = null, bd = 26;
      for (const s of sea.stars) { const d = Math.hypot(p.x - s.x * w, p.y - s.y * h); if (d < bd) { bd = d; best = s; } }
      if (best) sea.drag = { kind: 'star', star: best, dx: best.x * w - p.x, dy: best.y * h - p.y };
      return;
    }
    seaPush(p.x, 26, 5);
    seaRing(p, 1);
    if (soundOn()) Sound.plop(1);
    sea.drag = { kind: 'water', x: p.x, y: p.y, dist: 0 };
  }
  function seaDrag(p) {
    const d = sea.drag;
    if (!sea.y || !d) return;
    const { w, h } = bubbles.view, hy = seaHorizon(h), mr = seaMoonR(w, h);
    if (d.kind === 'moon') {
      // місяць можна опустити за обрій — він ховається у воду
      sea.moon.x = Math.max(mr, Math.min(w - mr, p.x + d.dx)) / w;
      sea.moon.y = Math.max(mr * 1.5, Math.min(hy + mr * 1.4, p.y + d.dy)) / h;
    } else if (d.kind === 'star') {
      d.star.x = Math.max(0.01, Math.min(0.99, (p.x + d.dx) / w));
      d.star.y = Math.max(0.01, Math.min((hy - 6) / h, (p.y + d.dy) / h));
    } else if (p.y > hy) {
      // палець по воді лишає ледь помітний слід із брижі
      const moved = Math.hypot(p.x - d.x, p.y - d.y);
      d.dist += moved; d.x = p.x; d.y = p.y;
      seaPush(p.x, Math.min(12, moved * 0.6), 3);
      if (d.dist > 38) { seaRing(p, 0.5); d.dist = 0; if (soundOn()) Sound.plop(0.45); }
    }
  }
  function drawSea(ctx, w, h, dt, now) {
    if (!sea.y || sea.w !== w || sea.h !== h) seaInit(w, h);
    seaStep(dt);
    const light = isLight(), hy = seaHorizon(h), base = seaBase(h);
    // небо
    const sky = ctx.createLinearGradient(0, 0, 0, hy);
    if (light) { sky.addColorStop(0, '#B9C7D3'); sky.addColorStop(1, '#EBD8C6'); }
    else { sky.addColorStop(0, '#0B1222'); sky.addColorStop(0.6, '#1C2440'); sky.addColorStop(1, '#3E3550'); }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, hy + 2);
    if (!light) for (const s of sea.stars) {
      // повільне дихання світла + ледь помітне тремтіння, як у справжніх зірок
      const tw = Math.max(0, Math.min(1, 0.5 + 0.42 * Math.sin(now / s.sp + s.ph) + 0.14 * Math.sin(now / 170 + s.ph * 3)));
      const sx = s.x * w, sy = s.y * h;
      if (s.r > 1.6) { // велика зірка — з тихим сяйвом
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, s.r * 5);
        g.addColorStop(0, `rgba(240,232,215,${0.22 + 0.12 * tw})`);
        g.addColorStop(1, 'rgba(240,232,215,0)');
        ctx.fillStyle = g;
        ctx.fillRect(sx - s.r * 5, sy - s.r * 5, s.r * 10, s.r * 10);
      }
      ctx.fillStyle = `rgba(240,232,215,${(s.r > 1.6 ? 0.55 : 0.25) + 0.35 * tw})`;
      ctx.beginPath(); ctx.arc(sx, sy, s.r, 0, Math.PI * 2); ctx.fill();
    }
    // місяць
    const mx = sea.moon.x * w, my = sea.moon.y * h, mr = seaMoonR(w, h);
    // наскільки місяць над обрієм: 1 — високо, 0 — сховався у воду; доріжка гасне разом із ним
    const moonUp = Math.max(0, Math.min(1, (hy - my + mr) / (mr * 2.6)));
    const glow = ctx.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 5);
    glow.addColorStop(0, light ? 'rgba(255,250,235,.55)' : 'rgba(244,227,195,.28)');
    glow.addColorStop(1, 'rgba(244,227,195,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(mx - mr * 5, my - mr * 5, mr * 10, mr * 10);
    ctx.fillStyle = light ? '#FFFBF0' : '#F4E3C3';
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
    // дальнє море
    const far = ctx.createLinearGradient(0, hy, 0, h);
    if (light) { far.addColorStop(0, '#9FB6BC'); far.addColorStop(1, '#6F8E93'); }
    else { far.addColorStop(0, '#1F2A3E'); far.addColorStop(1, '#0B1420'); }
    ctx.fillStyle = far;
    ctx.fillRect(0, hy, w, h - hy);
    // місячна доріжка — мерехтливі риски, що розходяться до берега
    for (let yy = hy + 3; yy < h; yy += 5) {
      const t = (yy - hy) / (h - hy), half = 6 + t * w * 0.16;
      const shift = Math.sin(yy * 0.13 + now / 600) * half * 0.5;
      const len = half * (0.4 + 0.6 * (0.5 + 0.5 * Math.sin(yy * 0.71 + now / 380)));
      ctx.fillStyle = light ? `rgba(255,255,255,${0.5 * (1 - t) * moonUp})` : `rgba(244,227,195,${0.42 * (1 - t * 0.8) * moonUp})`;
      ctx.fillRect(mx + shift - len / 2, yy, len, 1.6);
    }
    // дальні хвилі (паралакс)
    for (let l = 0; l < 3; l++) {
      const b = hy + (base - hy) * (0.25 + l * 0.27), amp = 2 + l * 2, len = 60 + l * 30, sp = now / (3000 - l * 500) * (l % 2 ? -1 : 1);
      ctx.beginPath(); ctx.moveTo(0, h);
      for (let x = 0; x <= w + 10; x += 10) ctx.lineTo(x, b + Math.sin(x / len + sp) * amp);
      ctx.lineTo(w, h); ctx.closePath();
      ctx.fillStyle = light ? `rgba(70,110,118,${0.12 + l * 0.06})` : `rgba(40,70,86,${0.25 + l * 0.12})`;
      ctx.fill();
    }
    // передня жива вода
    const pts = [];
    for (let i = 0; i < sea.cols; i++) pts.push(seaSurface(i, now));
    const top = Math.min(...pts);
    const water = ctx.createLinearGradient(0, top, 0, h);
    if (light) { water.addColorStop(0, 'rgba(96,150,150,.92)'); water.addColorStop(1, 'rgba(40,82,92,.98)'); }
    else { water.addColorStop(0, 'rgba(48,104,112,.92)'); water.addColorStop(0.45, 'rgba(22,58,72,.96)'); water.addColorStop(1, 'rgba(8,22,32,1)'); }
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < sea.cols; i++) ctx.lineTo(i * sea.step, pts[i]);
    ctx.lineTo(w, h); ctx.closePath();
    ctx.fillStyle = water;
    ctx.fill();
    // світлий гребінь
    ctx.beginPath();
    for (let i = 0; i < sea.cols; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, i * sea.step, pts[i]);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = light ? 'rgba(255,255,255,.6)' : 'rgba(190,230,225,.38)';
    ctx.stroke();
    // місячна доріжка і на передній воді — під місяцем, куди б його не пересунули
    for (let yy = top + 6; yy < h; yy += 7) {
      const t = (yy - top) / (h - top), half = w * (0.06 + t * 0.12);
      const shift = Math.sin(yy * 0.09 + now / 900) * half * 0.4;
      const len = half * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(yy * 0.53 + now / 520)));
      ctx.fillStyle = light ? `rgba(255,255,255,${0.22 * (1 - t) * moonUp})` : `rgba(244,227,195,${0.2 * (1 - t * 0.7) * moonUp})`;
      ctx.fillRect(mx + shift - len / 2, yy, len, 1.4);
    }
    // тихі кола від дотиків — лише на воді, нижче обрію; далі від берега
    // (ближче до обрію) — менші, як у перспективі
    ctx.save();
    ctx.beginPath(); ctx.rect(0, hy + 1, w, h - hy); ctx.clip();
    ctx.lineWidth = 1.2;
    for (const r of sea.rings) {
      const k = r.age / r.life, depth = 0.3 + 0.7 * Math.max(0, Math.min(1, (r.y - hy) / (h - hy)));
      const rad = (8 + k * (60 + 50 * r.k)) * depth;
      ctx.strokeStyle = light ? `rgba(255,255,255,${0.45 * (1 - k) * r.k})` : `rgba(210,235,230,${0.32 * (1 - k) * r.k})`;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, rad, rad * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
      if (k > 0.15) {
        const r2 = rad * 0.6;
        ctx.beginPath(); ctx.ellipse(r.x, r.y, r2, r2 * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
    ctx.restore();
    // відблиск місяця на передній воді
    const gl = ctx.createRadialGradient(mx, base + 20, 0, mx, base + 20, w * 0.35);
    gl.addColorStop(0, light ? `rgba(255,255,255,${0.16 * moonUp})` : `rgba(244,227,195,${0.1 * moonUp})`);
    gl.addColorStop(1, 'rgba(244,227,195,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, top, w, h - top);
  }
  const sceneWeight = (name, now) => {
    const k = Math.min(1, (now - scene.since) / SCENE_FADE);
    return (SCENES[scene.i] === name ? (scene.prev >= 0 ? k : 1) : 0)
      + (scene.prev >= 0 && SCENES[scene.prev] === name && k < 1 ? 1 - k : 0);
  };

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
    const k = Math.min(1, (now - scene.since) / SCENE_FADE);
    if (scene.prev >= 0 && k < 1) drawScene(SCENES[scene.prev], 1 - k, dt, now);
    drawScene(SCENES[scene.i], scene.prev >= 0 ? k : 1, dt, now);
    // бульбашки лише в дощі: на склі — краплі, у хвилях — вода
    const bubbleAlpha = Math.max(0, 1 - glassWeight(now) - sceneWeight('waves', now));
    ctx.save();
    ctx.globalAlpha = bubbleAlpha;
    bubbles.items.forEach((b, i) => {
      b.y -= b.vy * dt;
      b.ph += dt * 0.8;
      if (b.y < -b.r) { bubbles.items[i] = spawnBubble(false); return; }
      const x = bubbleX(b);
      ctx.beginPath();
      ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${b.hue}, 45%, ${L(64)}%,0.07)`;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = `hsla(${b.hue}, 45%, ${L(66)}%, 0.5)`;
      ctx.stroke();
      ctx.beginPath(); // відблиск
      ctx.arc(x, b.y, b.r * 0.68, Math.PI * 1.1, Math.PI * 1.45);
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.strokeStyle = isLight() ? `hsla(${b.hue}, 40%, 96%, 0.8)` : `hsla(${b.hue}, 50%, 78%, 0.45)`;
      ctx.stroke();
    });
    ctx.restore();
    while (bubbles.pops.length && now - bubbles.pops[0].t > POP_LIFE) bubbles.pops.shift();
    for (const p of bubbles.pops) {
      const k = (now - p.t) / POP_LIFE;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (1 + k * 0.6), 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = `hsla(${p.hue}, 45%, ${L(70)}%, ${(1 - k) * 0.6})`;
      ctx.stroke();
    }
    Detox.raf = requestAnimationFrame(bubblesFrame);
  }
  function bubbleTap(e) {
    const p = pointIn($('bubbles-canvas'), e);
    const now = performance.now();
    if (glassWeight(now) > 0.5) { glassTap(p); return; }
    if (sceneWeight('waves', now) > 0.5) { seaTouch(p); return; }
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
    $('d-exit').addEventListener('click', backToDetox);
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

    $('bubbles-canvas').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      bubbleTap(e);
    });
    $('bubbles-canvas').addEventListener('pointermove', (e) => {
      if (!sea.drag) return;
      seaDrag(pointIn($('bubbles-canvas'), e));
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => $('bubbles-canvas').addEventListener(ev, () => { sea.drag = null; }));
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
  let leaving = null, leaveTimer = 0;
  function showScreen(id) {
    // м'яке розчинення: попередній екран ще 0,45 с тане під новим
    if (leaving) { clearTimeout(leaveTimer); leaving.classList.remove('leaving'); leaving.inert = false; leaving = null; }
    const prev = Array.from(screens).find((el) => !el.hidden && el.id !== id);
    currentScreen = id;
    if (id === 's-home') { // «Моя опора» — одразу на головній: фраза або запрошення її додати
      const has = !!getAnchor();
      $('home-anchor').classList.toggle('is-empty', !has);
      $('home-anchor-text').textContent = has ? quoteAnchor() : tr('anchorAdd');
      const h = new Date().getHours();
      $('home-greet').textContent = tr(h >= 5 && h < 12 ? 'greetMorning' : h >= 12 && h < 18 ? 'greetDay' : h >= 18 && h < 23 ? 'greetEvening' : 'greetNight');
      $('home-greet').parentNode.classList.toggle('is-night', h >= 18 || h < 5);
    }
    screens.forEach((el) => { el.hidden = el.id !== id; });
    document.body.dataset.screen = id;
    if (prev) {
      leaving = prev;
      prev.inert = true;
      prev.classList.add('leaving');
      leaveTimer = setTimeout(() => { prev.classList.remove('leaving'); prev.inert = false; if (leaving === prev) leaving = null; }, 460);
    }
    // у світлій темі сон і «Побути поруч» лишаються чорними — системні рядки теж
    if (settings.theme === 'dawn') applyTheme('dawn', id === 's-b2');
    // Один запис в історії на весь час поза головним екраном — щоб системна
    // кнопка «Назад» вела додому (див. обробник popstate в init)
    // У застосунку «Назад» обробляє App.backButton, історія не потрібна.
    if (NATIVE) return;
    const depth = (history.state && history.state.depth) || 0;
    if (id !== 's-home' && id !== 's-intro' && depth === 0) {
      try { history.pushState({ inApp: true, depth: 1 }, ''); } catch (e) { /* noop */ }
    }
    // Вправа Детоксу — другий рівень: «Назад» спершу веде до списку Детоксу.
    // Запис додається одразу при натисканні (жест користувача): браузер
    // пропускає записи, додані без жесту, тож «Назад» інакше губився б.
    if (SUBSCREENS.includes(id) && depth === 1) {
      try { history.pushState({ inApp: true, depth: 2 }, ''); } catch (e) { /* noop */ }
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
    Tuner.stop();
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
    const depth = (history.state && history.state.depth) || 0;
    if (depth > 0) {
      try { history.go(-depth); } catch (e) { /* noop */ }
    }
  }
  /* Екрани другого рівня: «Назад» веде не додому, а до батьківського екрана.
     Вправа Детоксу → список Детоксу; сон → налаштування сну. */
  const SUBSCREENS = ['s-d-act', 's-b2'];
  function goParent(fromHistory) {
    if (currentScreen === 's-d-act') { openDetox(); praiseIfStayed(); }
    else if (currentScreen === 's-b2') { stopEverything(); updateVoiceHint(); showScreen('s-b1'); }
    if (!fromHistory && history.state && history.state.depth === 2) {
      try { history.back(); } catch (e) { /* noop */ }
    }
  }
  const backToDetox = () => goParent(false);

  /* Радиогруппы: выделяют активную кнопку и сохраняют выбор. */
  function bindRadio(group, attr, current, onChange) {
    const buttons = Array.from(group.querySelectorAll('button[role="radio"]'));
    const paint = (value) => buttons.forEach((b) => b.setAttribute('aria-checked', String(b.dataset[attr] === value)));
    paint(current);
    buttons.forEach((b) => b.addEventListener('click', () => {
      paint(b.dataset[attr]);
      onChange(b.dataset[attr]);
    }));
  }

  /* Кнопка режиму на головному: міні-картинки звуку, вібрації або ока */
  const FB_MODES = ['sound', 'vibro', 'visual'];
  const FB_LABEL = { sound: 'fbSound', vibro: 'fbVibro', visual: 'fbVisual' };
  const svgIcon = (body) => `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const ICON_SOUND = svgIcon('<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/><path d="M18.3 6.5a8 8 0 0 1 0 11"/>');
  const ICON_VIBRO = svgIcon('<rect x="8" y="3.5" width="8" height="17" rx="2"/><path d="M11 17.5h2"/><path d="M4.5 8.5v7M2 10.5v3M19.5 8.5v7M22 10.5v3"/>');
  const ICON_VISUAL = svgIcon('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>');
  const FB_ICONS = { sound: ICON_SOUND + ICON_VIBRO, vibro: ICON_VIBRO, visual: ICON_VISUAL };
  function paintFeedback() {
    const btn = $('feedback');
    if (!btn) return;
    const label = tr(FB_LABEL[settings.feedback] || 'fbSound');
    $('fb-icons').innerHTML = FB_ICONS[settings.feedback] || FB_ICONS.sound;
    $('fb-label').textContent = label;
    btn.setAttribute('aria-label', `${tr('feedbackLabel')}: ${label}`);
  }

  function updateVoiceHint() {
    const hint = $('voice-hint');
    if (!hint) return;
    let text = '';
    if (settings.feedback === 'visual') text = tr('hintVisual');
    else if (!Speech.available(settings.lang)) text = tr('hintNoVoice');
    hint.textContent = text;
    hint.hidden = !text;
    paintRadioLangs();
  }

  /* «Радіо»: вкладка є завжди. Коли воно обране — вибір мови з наявних
     голосів або підказка, як додати голос у налаштуваннях телефона. */
  function paintRadioLangs() {
    const chip = $('radio-lang'), note = $('radio-hint');
    if (!chip || !note) return;
    const list = radioLangs();
    const cur = radioLang();
    chip.hidden = !cur;
    note.hidden = settings.sleepMode !== 'radio' || !!cur;
    note.textContent = tr('radioNoVoice');
    if (cur) {
      chip.textContent = cur.key.toUpperCase();
      chip.setAttribute('lang', cur.key);
      chip.setAttribute('aria-label', `${tr('radioLangLbl')}: ${cur.name}`);
      chip.disabled = false;
      chip.dataset.count = String(list.length);
    }
  }
  /* Кнопка мови: перший дотик (якщо «Радіо» ще не обране) — обирає його;
     далі кожен дотик — наступна наявна мова й коротка фраза-зразок */
  function cycleRadioLang() {
    const list = radioLangs();
    if (!list.length) return;
    if (settings.sleepMode !== 'radio') $('tab-radio').click();
    else if (list.length > 1) {
      const cur = radioLang();
      const next = list[(list.findIndex((l) => l.key === (cur && cur.key)) + 1) % list.length];
      settings.radioLang = next.key; Store.set('radioLang', next.key);
    }
    paintRadioLangs();
    const pick = radioLang();
    stopVoice();
    if (pick && pick.rec && Sound.ready) {
      // зразок — перші секунди вступу; таймер не зачепить інший звук, що почався після
      Clips.play(radioClip(pick.key, 1), SPEECH_BASE_VOLUME);
      const g = Clips.gen;
      setTimeout(() => { if (Clips.gen === g) Clips.stop(); }, 5000);
    } else if (pick) Speech.speakForeign(RADIO_TEXT[pick.key][0], pick.tag, 0.82, SPEECH_BASE_VOLUME, true);
  }

  /* ================= 8a. Налаштування ================= */
  // Збільшувати разом із CACHE у sw.js
  const APP_VERSION = 76;
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
  // Сайт застосунку: ним діляться, поки «Якоря» ще немає в магазинах
  const WEB_URL = 'https://yulianachera-del.github.io/yakir/';
  const APP_ID = 'ua.yakir.app';
  /* Добровільна підтримка: посилання на сторінку донату. Порожнє — рядок
     у налаштуваннях не показується. У застосунку з магазинів рядок
     ховаємо: Google Play і App Store вимагають, щоб «чайові» розробнику
     йшли через їхню оплату, тож зовнішнє посилання є лише на сайті. */
  const DONATE_URL = '';
  const STORE_URL = PLATFORM === 'ios'
    ? WEB_URL // TODO: посилання на App Store після публікації
    : `https://play.google.com/store/apps/details?id=${APP_ID}`;

  /* Рядки-«розгортайки»: праворуч поточне значення ›, дотик відкриває
     варіанти під рядком; після вибору рядок згортається */
  function setFold(fold, open) {
    fold.querySelector('.set-value').setAttribute('aria-expanded', String(open));
    fold.querySelectorAll('[role="radiogroup"], .set-fold__more').forEach((el) => { el.hidden = !open; });
  }
  function paintFolds() {
    document.querySelectorAll('.set-fold').forEach((f) => {
      const on = f.querySelector('[role="radiogroup"] [aria-checked="true"]');
      f.querySelector('.set-value > span').textContent = on ? on.textContent.trim() : '';
    });
  }
  function openSettings() {
    $('set-version').textContent = `${tr('version')} ${APP_VERSION}`;
    const A = plugin('App');
    if (A) A.getInfo().then((i) => { $('set-version').textContent = `${tr('version')} ${i.version} (${i.build})`; }).catch(() => {});
    updStatus(updateReady ? 'updFound' : '');
    // У застосунку оновлення приходять через магазин
    if (NATIVE) {
      $('update-check').textContent = tr(PLATFORM === 'ios' ? 'updAppStore' : 'updPlay');
      updStatus('');
    }
    $('reset-confirm').hidden = true; $('reset-ask').hidden = false;
    $('set-cues').setAttribute('aria-checked', String(settings.voiceCues));
    document.querySelectorAll('.set-fold').forEach((f) => setFold(f, false));
    paintFolds();
    $('s-settings').querySelector('.settings').scrollTop = 0;
    showScreen('s-settings');
  }
  async function checkUpdate() {
    const btn = $('update-check');
    if (btn.disabled) return;
    if (NATIVE) { location.href = STORE_URL; return; } // відкриється магазин
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
  function previewVolume() {
    clearTimeout(previewTimer);
    Sound.startNoise(0.4, NOISE_LEVEL.rain, 'rain');
    previewTimer = setTimeout(() => Sound.stopNoise(1.2), 3000);
  }

  async function shareApp() {
    const url = NATIVE ? WEB_URL : new URL('./', location.href).href;
    const data = { title: tr('appName'), text: tr('shareText'), url };
    const S = plugin('Share');
    if (S) {
      try { await S.share({ ...data, dialogTitle: tr('share') }); } catch (e) { /* закрили вікно */ }
      return;
    }
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

  /* Тема: атрибут на <html>, колір системних рядків (у браузері — theme-color,
     у застосунку — нативно, щоб значки годинника й заряду були видні) */
  const THEME_BG = { night: '#0B0D10', dusk: '#13121B', dawn: '#E5D9C8' };
  function applyTheme(name, onBlack) {
    const root = document.documentElement;
    if (name === 'night') delete root.dataset.theme; else root.dataset.theme = name;
    const dark = onBlack || name !== 'dawn';
    const color = onBlack ? '#000000' : THEME_BG[name];
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = color;
    const imm = plugin('Immersive');
    if (imm && imm.bars) imm.bars({ color, light: !dark }).catch(() => {});
  }

  /* Перемикач увімк./вимк. (role="switch"): стан — в aria-checked */
  function bindSwitch(el, on, onChange) {
    el.setAttribute('aria-checked', String(on));
    el.addEventListener('click', () => {
      const next = el.getAttribute('aria-checked') !== 'true';
      el.setAttribute('aria-checked', String(next));
      Haptic.play(15);
      onChange(next);
    });
  }

  function bindSettings() {
    applyTheme(settings.theme);
    bindRadio($('set-theme'), 'value', settings.theme, (v) => {
      settings.theme = v; Store.set('theme', v); applyTheme(v);
    });
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
    document.querySelectorAll('.set-fold').forEach((f) => {
      const btn = f.querySelector('.set-value');
      btn.addEventListener('click', () => setFold(f, btn.getAttribute('aria-expanded') !== 'true'));
      // вибір зроблено — показуємо нове значення й згортаємо (після обробника радіогрупи)
      f.querySelector('[role="radiogroup"]').addEventListener('click', (e) => {
        if (!e.target.closest('button[role="radio"]')) return;
        setTimeout(() => { paintFolds(); if (f.id !== 'icon-block') setFold(f, false); }, 0);
      });
    });
    bindSwitch($('set-text'), settings.textSize === 'large', (on) => {
      const v = on ? 'large' : 'normal';
      settings.textSize = v; Store.set('textSize', v);
      document.documentElement.classList.toggle('text-lg', on);
    });
    // Що відкривати при запуску
    if (!['home', 'calm', 'near'].includes(settings.start)) settings.start = 'home';
    bindRadio($('set-start'), 'value', settings.start, (v) => { settings.start = v; Store.set('start', v); });
    // Голос
    bindSwitch($('set-cues'), settings.voiceCues, (on) => {
      settings.voiceCues = on; Store.set('voiceCues', on ? '1' : '0');
    });
    bindRadio($('set-speed'), 'value', settings.voiceSpeed, (v) => {
      settings.voiceSpeed = v; Store.set('voiceSpeed', v);
      Sound.unlock(); Speech.speak('10, 9, 8', settings.lang, 1, Math.min(1, SPEECH_BASE_VOLUME)); // одразу чути новий темп (синтезатор)
    });
    // Гучність фону: зразок звуку, щоб одразу почути різницю
    bindRadio($('set-volume'), 'value', settings.volume, (v) => {
      settings.volume = v; Store.set('volume', v);
      Sound.unlock(); Sound.setVolume(v);
      previewVolume();
    });
    // Тривалість сну
    bindRadio($('set-sleep'), 'value', settings.sleepMin, (v) => {
      settings.sleepMin = v; Store.set('sleepMin', v); applyLang();
    });
    // Поділитися
    $('btn-share').addEventListener('click', shareApp);
    if (DONATE_URL && !NATIVE) { $('donate-link').href = DONATE_URL; $('donate-link').hidden = false; }
    // Скинути все — лише після підтвердження
    $('reset-ask').addEventListener('click', () => {
      $('reset-ask').hidden = true; $('reset-confirm').hidden = false;
      // попередження з’являється внизу — прокручуємо, щоб його було видно
      const box = $('s-settings').querySelector('.settings');
      setTimeout(() => box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' }), 30);
      // запасний варіант, якщо плавна прокрутка не спрацювала
      setTimeout(() => { if (box.scrollHeight - box.clientHeight - box.scrollTop > 40) box.scrollTop = box.scrollHeight; }, 900);
    });
    // Приватність — окрема сторінка; позначка #settings у поточному записі
    // історії повертає саме в Налаштування (і стрілкою, і «Назад» телефона)
    $('privacy-link').addEventListener('click', () => {
      try { history.replaceState(history.state, '', '#settings'); } catch (e) { /* noop */ }
    });
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
    Clips.init().then(() => paintRadioLangs()); // записане радіо з'являється після переліку файлів

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
    window.addEventListener('popstate', (e) => {
      if (NATIVE) return;
      const depth = (e.state && e.state.depth) || 0;
      if (SUBSCREENS.includes(currentScreen)) goParent(true);
      if (depth === 0 && currentScreen !== 's-home' && currentScreen !== 's-intro') leaveToHome();
    });
    // У застосунку Android: свайп чи кнопка «Назад»
    const capApp = plugin('App');
    if (capApp) {
      capApp.addListener('backButton', () => {
        if (SUBSCREENS.includes(currentScreen)) goParent(false);
        else if (currentScreen === 's-home' || currentScreen === 's-intro') capApp.minimizeApp();
        else leaveToHome();
      });
    }

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

    // Перший запуск: три кроки; «Пропустити» — одразу на головну
    let introStep = 1;
    const showIntroStep = (n) => {
      introStep = n;
      document.querySelectorAll('#s-intro .intro-step').forEach((el) => { el.hidden = Number(el.dataset.step) !== n; });
      $('intro-dots').querySelectorAll('i').forEach((d, i) => d.classList.toggle('now', i === n - 1));
      $('intro-dots').setAttribute('aria-label', tr('introStep').replace('{n}', n));
      const last = n === 3;
      $('intro-next').hidden = last;
      $('btn-intro').hidden = !last;
      $('intro-skip').style.visibility = last ? 'hidden' : '';
    };
    showIntroStep(1);
    const finishIntro = () => { Sound.unlock(); Store.set('seen', '1'); showScreen('s-home'); };
    $('intro-next').addEventListener('click', () => { Sound.unlock(); showIntroStep(introStep + 1); });
    $('intro-skip').addEventListener('click', finishIntro);
    $('btn-intro').addEventListener('click', finishIntro);

    $('btn-calm').addEventListener('click', () => { Sound.unlock(); startFlowA(); });
    $('btn-sleep').addEventListener('click', () => { Sound.unlock(); updateVoiceHint(); showScreen('s-b1'); });

    // Режим відгуку: одна кнопка, натискання — наступний режим по колу
    if (!FB_MODES.includes(settings.feedback)) settings.feedback = 'sound';
    paintFeedback();
    $('feedback').addEventListener('click', () => {
      const v = FB_MODES[(FB_MODES.indexOf(settings.feedback) + 1) % FB_MODES.length];
      settings.feedback = v; Store.set('feedback', v);
      paintFeedback();
      if (v !== 'visual') Haptic.play(40); // одразу відчути обраний відгук
      if (v === 'sound') Sound.bell(659.25);
    });

    // Поток А
    $('a-exit').addEventListener('click', goHome);
    // Навігація по етапах: натискання на сегмент прогресу відкриває цей етап
    progressA.forEach((b, i) => b.addEventListener('click', () => startStageA(i)));
    $('a-voice').addEventListener('click', () => {
      const v = soundOn() ? 'vibro' : 'sound';
      settings.feedback = v; Store.set('feedback', v);
      // увімкнули звук — повертаємо й голос, інакше динамік «увімкнений», а тиша
      if (v === 'sound' && !settings.voiceCues) { settings.voiceCues = true; Store.set('voiceCues', '1'); }
      if (v !== 'sound') stopVoice();
      paintFeedback();
      paintVoiceButton();
      updateVoiceHint();
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
    $('kid-games').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.dataset.value === kid.game) return;
      kid.game = b.dataset.value;
      Store.set('kidGame', kid.game);
      startKid();
    });

    // «Моя опора»
    $('home-anchor').addEventListener('click', () => openAnchor(goHome));
    $('anchor-exit').addEventListener('click', closeAnchor);
    $('anchor-input').addEventListener('input', paintAnchorCount);
    $('anchor-save').addEventListener('click', () => {
      const value = $('anchor-input').value.trim();
      Store.set('anchorText', value);
      closeAnchor();
      if (value) toast(tr('anchorSaved'));
    });
    $('anchor-clear').addEventListener('click', () => { Store.set('anchorText', ''); closeAnchor(); });

    // Б1
    $('b1-exit').addEventListener('click', goHome);
    if (!['count', 'words', 'radio'].includes(settings.sleepMode)) settings.sleepMode = 'count';
    bindRadio($('sleep-mode'), 'value', settings.sleepMode, (v) => { settings.sleepMode = v; Store.set('sleepMode', v); paintRadioLangs(); });
    $('radio-lang').addEventListener('click', cycleRadioLang);
    document.querySelectorAll('.lang-btn').forEach((b) => b.addEventListener('click', nextLang));
    bindDetox();
    bindSettings();
    applyLang();
    if (!['off', 'brown', 'rain'].includes(settings.bg)) settings.bg = 'off';
    bindRadio($('bg-sound'), 'value', settings.bg, (v) => {
      settings.bg = v; Store.set('sleepBg', v);
      // зразок обраного фону на 3 с, щоб почути різницю ще до сну
      Sound.unlock();
      clearTimeout(previewTimer);
      if (v === 'off') { Sound.stopNoise(0.4); return; }
      Sound.startNoise(0.4, NOISE_LEVEL[v], v);
      previewTimer = setTimeout(() => { if (currentScreen === 's-b1') Sound.stopNoise(1.2); }, 3000);
    });
    $('btn-sleep-start').addEventListener('click', () => { Sound.unlock(); startSleep(); });

    // Б2: выход только удержанием
    const b2 = $('s-b2');
    b2.addEventListener('pointerdown', (e) => { e.preventDefault(); holdStart(e); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => b2.addEventListener(ev, holdCancel));
    Tuner.bind();

    // Стартовий екран: головна або одразу вправа (якщо так обрано в Налаштуваннях)
    if (Store.get('seen', '') !== '1') showScreen('s-intro');
    else if (location.hash === '#settings') {
      // повернення зі сторінки «Приватність»
      try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) { /* noop */ }
      showScreen('s-home');
      openSettings();
    } else {
      showScreen('s-home');
      if (settings.start === 'calm') startFlowA(true);
      else if (settings.start === 'near') startNear();
    }

    // Service Worker: кэширует всё при первом запуске → дальше полный офлайн
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      window.addEventListener('load', () => {
        // У застосунку файли вже лежать усередині — офлайн-кеш не потрібен
        if (!NATIVE) navigator.serviceWorker.register('sw.js').catch(() => {});
      });
    }
  }

  init();
})();
