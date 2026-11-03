import { createOpeningAudio } from './openingAudio.js';
import { createOpeningChoice } from './openingChoice.js';
import { createOpeningScene } from './openingScene.js';
import { OPENING_CARD, createOpeningFlightLayout, openingFlightPose, openingRevealPose } from './openingFlight.js';

export function mountOpening(root, { onStart, onComplete, onModeSelect = () => {}, onReveal = () => {}, initialSound = true, onSoundChange = () => {} }) {
  const canvas = root.querySelector("[data-cover-canvas]"),
    ctx = canvas.getContext("2d");
  // The cover keeps its original contained framing. The thrown card has its
  // own viewport-sized canvas so it can cover phones and wide screens alike.
  const flightCanvas = root.querySelector('[data-flight-canvas]');
  const flightContext = flightCanvas.getContext('2d');
  let flightLayout, flightPixelRatio;
  const scroller = root.ownerDocument.documentElement;
  const previousOverflow = scroller.style.overflow;
  let scrollingLocked = true;
  scroller.style.overflow = 'hidden';
  function unlockScrolling() {
    if (!scrollingLocked) return;
    scrollingLocked = false;
    scroller.style.overflow = previousOverflow;
  }
  const source = root.querySelector("[data-source]"),
    closed = root.querySelector("[data-closed]"),
    plate = root.querySelector("[data-plate]");
  const startButton = root.querySelector(".start-game"),
    pause = root.querySelector("[data-pause]"),
    status = root.querySelector("[data-status]");
  const layer = document.createElement("canvas");
  layer.width = 1672;
  layer.height = 941;
  const lc = layer.getContext("2d");
  // 连续采样保留原画纹理，取消逐条拉伸和像素取整造成的跳动。
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // One timeline owns phase durations; later phases derive their boundaries.
  const DURATIONS = {
    retreat: 2.65,
    darkPause: 0.2,
    flight: 0.92,
    hold: 0.3,
    reveal: 0.82,
  };
  const ENDS = {};
  let timelineEnd = 0;
  for (const [phase, duration] of Object.entries(DURATIONS))
    ENDS[phase] = timelineEnd += duration;
  const FADE_WINDOWS = {
    outer: [0, 0.6],
    cheeks: [0.1, 2.25],
    smile: [2.25, 2.65],
  };
  const SUBJECT = { x: 565, y: 112, width: 700, height: 666 };
  const listeners = new AbortController();
  const listen = (target, event, callback) =>
    target.addEventListener(event, callback, { signal: listeners.signal });
  let disposed = false;
  const grinImage = root.querySelector("[data-grin]");
  const EXPRESSION = {
    start: 0.6,
    end: 2.05,
    x: 676,
    y: 390,
    width: 156,
    height: 190,
  };
  let morphFrames = [],
    morphPose,
    morphContext,
    morphPatch;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const soundButton = root.querySelector("[data-sound]"),
    skipButton = root.querySelector("[data-skip]");
  let soundEnabled = initialSound;
  let audioContext, audioBus, voices = [];
  let loadFailed = false;
  let grinPlayed = false;
  let revealStarted = false;
  let revealPrepared = false;
  const openingAudio = createOpeningAudio(import.meta.env.BASE_URL, () => updateSound());
  function updateSound() {
    soundButton.textContent = soundEnabled ? (openingAudio.blocked ? "点击开启声音" : "声音：开") : "声音：关";
    soundButton.setAttribute("aria-pressed", String(soundEnabled));
    if (audioBus)
      audioBus.gain.setTargetAtTime(
        soundEnabled ? 0.35 : 0,
        audioContext.currentTime,
        0.025,
      );
  }
  function unlockAudio() {
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      if (!audioContext) {
        audioContext = new Audio();
        audioBus = audioContext.createGain();
        audioBus.gain.value = soundEnabled ? 0.35 : 0;
        audioBus.connect(audioContext.destination);
      }
      audioContext.resume().catch(() => {});
    } catch {
      soundButton.textContent = "声音不可用";
    }
  }
  function stopAudio() {
    for (const voice of voices) {
      try {
        voice.stop();
      } catch {}
    }
    voices = [];
  }
  function tone(start, end, duration, volume) {
    if (!audioContext || !soundEnabled) return;
    const now = audioContext.currentTime,
      o = audioContext.createOscillator(),
      g = audioContext.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(start, now);
    o.frequency.exponentialRampToValueAtTime(end, now + duration);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(volume, now + 0.035);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    o.connect(g);
    g.connect(audioBus);
    o.start();
    o.stop(now + duration + 0.02);
    voices.push(o);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
      voices = voices.filter((v) => v !== o);
    };
  }
  function whoosh(duration, volume) {
    if (!audioContext || !soundEnabled) return;
    const now = audioContext.currentTime,
      b = audioContext.createBuffer(
        1,
        Math.ceil(audioContext.sampleRate * duration),
        audioContext.sampleRate,
      ),
      d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const n = audioContext.createBufferSource(),
      f = audioContext.createBiquadFilter(),
      g = audioContext.createGain();
    n.buffer = b;
    f.type = "bandpass";
    f.Q.value = 0.7;
    f.frequency.setValueAtTime(350, now);
    f.frequency.exponentialRampToValueAtTime(2600, now + duration * 0.7);
    f.frequency.exponentialRampToValueAtTime(500, now + duration);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(volume, now + duration * 0.65);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    n.connect(f);
    f.connect(g);
    g.connect(audioBus);
    n.start();
    voices.push(n);
    n.onended = () => {
      n.disconnect();
      f.disconnect();
      g.disconnect();
      voices = voices.filter((v) => v !== n);
    };
  }
  listen(soundButton, "click", () => {
    if (!(soundEnabled && openingAudio.blocked)) soundEnabled = !soundEnabled;
    openingAudio.setEnabled(soundEnabled);
    unlockAudio();
    updateSound();
    onSoundChange(soundEnabled);
  });
  updateSound();
  openingAudio.setEnabled(soundEnabled);
  listen(root, "pointerdown", (event) => {
    if (!event.target.closest("button")) { unlockAudio(); openingAudio.resume(); }
  });
  let darknessMasks = [],
    retreatLayers = [],
    retreatBreath = 0;
  let time = 0,
    previous = 0,
    state = "idle",
    elapsed = 0,
    playing = !reduced,
    raf,
    leftPatch,
    rightPatch;
  const clamp = (x) => Math.max(0, Math.min(1, x)),
    smooth = (x) => {
      x = clamp(x);
      return x * x * (3 - 2 * x);
    };
  function blink(age) {
    if (age < 0 || age > 0.32) return 0;
    if (age < 0.085) return smooth(age / 0.085);
    if (age < 0.12) return 1;
    return 1 - smooth((age - 0.12) / 0.2);
  }
  function patch(x, y) {
    const c = document.createElement("canvas");
    c.width = 140;
    c.height = 84;
    const p = c.getContext("2d");
    p.drawImage(closed, x - 70, y - 42, 140, 84, 0, 0, 140, 84);
    p.globalCompositeOperation = "destination-in";
    p.translate(70, 42);
    p.scale(70, 42);
    const g = p.createRadialGradient(0, 0, 0.6, 0, 0, 1);
    g.addColorStop(0, "#000");
    g.addColorStop(1, "#0000");
    p.fillStyle = g;
    p.fillRect(-1, -1, 2, 2);
    return c;
  }
  function buildPose() {
    lc.clearRect(0, 0, 1672, 941);
    lc.drawImage(source, 0, 0, 1672, 941);
    lc.globalAlpha = blink((time % 8.6) - 2.3);
    lc.drawImage(leftPatch, 680, 291);
    lc.globalAlpha = blink((time % 8.6) - 2.34);
    lc.drawImage(rightPatch, 842, 290);
    lc.globalAlpha = 1;
  }
  // Partition opacity rather than stacking bright patches: all weights sum to one.
  function buildDarknessMasks() {
    const { x, y, width, height } = SUBJECT;
    const masks = Array.from({ length: 3 }, () => {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      return c;
    });
    const images = masks.map((c) =>
      c.getContext("2d").createImageData(width, height),
    );
    for (let py = 0; py < height; py++)
      for (let px = 0; px < width; px++) {
        const wx = x + px,
          wy = y + py;
        const mouthDistance = Math.hypot((wx - 835) / 155, (wy - 478) / 82);
        const mouth = 1 - smooth((mouthDistance - 0.4) / 0.6);
        const cheekDistance = Math.hypot((wx - 820) / 190, (wy - 454) / 153);
        const cheek =
          (1 - smooth((cheekDistance - 0.35) / 0.65)) *
          smooth((wy - 345) / 75) *
          (1 - mouth);
        const alphas = [
          Math.round((1 - mouth - cheek) * 255),
          Math.round(cheek * 255),
        ];
        alphas.push(255 - alphas[0] - alphas[1]);
        for (let i = 0; i < 3; i++) {
          const offset = (py * width + px) * 4;
          images[i].data[offset] =
            images[i].data[offset + 1] =
            images[i].data[offset + 2] =
              255;
          images[i].data[offset + 3] = alphas[i];
        }
      }
    masks.forEach((c, i) => c.getContext("2d").putImageData(images[i], 0, 0));
    return masks;
  }
  function captureRetreat() {
    buildPose();
    retreatBreath = reduced ? 0 : Math.sin(time * 1.12);
    retreatLayers = splitRetreatPose(layer);
    morphPose = document.createElement("canvas");
    morphPose.width = 1672;
    morphPose.height = 941;
    morphContext = morphPose.getContext("2d");
    morphPatch = document.createElement("canvas");
    morphPatch.width = EXPRESSION.width;
    morphPatch.height = EXPRESSION.height;
  }
  // Align both textures to the same moving lip contours before blending them.
  // The perimeter stays fixed; the left corner lifts and the lip gap opens gradually.
  function buildMorphFrames() {
    const { x, y, width, height } = EXPRESSION;
    const neutral = document.createElement("canvas");
    neutral.width = width;
    neutral.height = height;
    neutral
      .getContext("2d")
      .drawImage(source, x, y, width, height, 0, 0, width, height);
    const target = document.createElement("canvas");
    target.width = width;
    target.height = height;
    const targetContext = target.getContext("2d");
    targetContext.drawImage(neutral, 0, 0);
    targetContext.drawImage(makeGrinPatch(), 0, 0);
    const columns = [0, 28, 56, 89, 122, 156];
    const neutralTop = [70, 75, 83, 96, 98, 95],
      targetTop = [70, 35, 60, 77, 86, 88];
    const neutralBottom = [116, 118, 94, 114, 128, 130],
      targetBottom = [116, 95, 129, 145, 155, 145];
    function sample(values, x) {
      let i = 0;
      while (i < columns.length - 2 && x > columns[i + 1]) i++;
      const t = (x - columns[i]) / (columns[i + 1] - columns[i]);
      return values[i] + (values[i + 1] - values[i]) * t;
    }
    return Array.from({ length: 61 }, (_, frame) => {
      const t = frame / 60,
        c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      const context = c.getContext("2d");
      context.globalCompositeOperation = "lighter";
      for (let x = 0; x < width; x++) {
        const a = [0, sample(neutralTop, x), sample(neutralBottom, x), height];
        const z = [0, sample(targetTop, x), sample(targetBottom, x), height];
        const jaw = t;
        const teeth = t;
        const dest = a.map(
          (value, i) => value + (z[i] - value) * (i === 2 ? jaw : t),
        );
        for (const [image, rows, weight] of [
          [neutral, a, 1 - teeth],
          [target, z, teeth],
        ]) {
          if (weight === 0) continue;
          context.globalAlpha = weight;
          for (let row = 0; row < 3; row++)
            context.drawImage(
              image,
              x,
              rows[row],
              1,
              rows[row + 1] - rows[row],
              x,
              dest[row],
              1,
              dest[row + 1] - dest[row],
            );
        }
      }
      return c;
    });
  }
  function updateMorph(progress) {
    const frame = progress * (morphFrames.length - 1),
      first = Math.floor(frame),
      second = Math.min(first + 1, morphFrames.length - 1),
      mix = frame - first;
    const context = morphPatch.getContext("2d");
    context.clearRect(0, 0, EXPRESSION.width, EXPRESSION.height);
    context.globalCompositeOperation = "lighter";
    context.globalAlpha = 1 - mix;
    context.drawImage(morphFrames[first], 0, 0);
    context.globalAlpha = mix;
    context.drawImage(morphFrames[second], 0, 0);
    morphContext.clearRect(0, 0, 1672, 941);
    morphContext.drawImage(layer, 0, 0);
    morphContext.drawImage(morphPatch, EXPRESSION.x, EXPRESSION.y);
    const { x, y, width, height } = SUBJECT;
    retreatLayers.forEach((canvas, index) => {
      const context = canvas.getContext("2d");
      context.globalCompositeOperation = "source-over";
      context.clearRect(0, 0, width, height);
      context.drawImage(morphPose, x, y, width, height, 0, 0, width, height);
      context.globalCompositeOperation = "destination-in";
      context.drawImage(darknessMasks[index], 0, 0);
    });
  }
  function makeGrinPatch() {
    const { width, height } = EXPRESSION;
    const patch = document.createElement("canvas");
    patch.width = width;
    patch.height = height;
    const context = patch.getContext("2d");
    context.drawImage(grinImage, 0, 0, width, height);
    const mask = document.createElement("canvas");
    mask.width = width;
    mask.height = height;
    const maskContext = mask.getContext("2d"),
      pixels = maskContext.createImageData(width, height);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const edge =
          smooth(x / 24) * smooth(y / 23) * smooth((height - y) / 27);
        pixels.data[(y * width + x) * 4 + 3] = Math.round(255 * edge);
      }
    maskContext.putImageData(pixels, 0, 0);
    context.globalCompositeOperation = "destination-in";
    context.drawImage(mask, 0, 0);
    return patch;
  }
  function splitRetreatPose(pose) {
    const { x, y, width, height } = SUBJECT;
    return darknessMasks.map((mask) => {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      const context = c.getContext("2d");
      context.drawImage(pose, x, y, width, height, 0, 0, width, height);
      context.globalCompositeOperation = "destination-in";
      context.drawImage(mask, 0, 0);
      return c;
    });
  }
  function drawTable() {
    ctx.drawImage(source, 0, 778, 1672, 163, 0, 778, 1672, 163);
  }
  function drawDarkStage() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 1672, 941);
    drawTable();
  }
  function subjectTransform(breath) {
    ctx.translate(854, 620 + 8 * breath);
    const scale = 1 + 0.008 * breath;
    ctx.scale(scale, scale);
    ctx.translate(-854, -620);
  }
  function cover() {
    drawDarkStage();
    ctx.save();
    subjectTransform(reduced ? 0 : Math.sin(time * 1.12));
    const { x, y, width, height } = SUBJECT;
    ctx.drawImage(layer, x, y, width, height, x, y, width, height);
    ctx.restore();
    drawTable();
  }
  function drawRetreat(seconds) {
    drawDarkStage();
    ctx.save();
    // Keep the clicked pose in place; only the remaining breath gently settles.
    const settling =
      (Math.sin(time * 1.12) - retreatBreath) *
      (1 - smooth(seconds / DURATIONS.retreat));
    subjectTransform(retreatBreath + (reduced ? 0 : settling));
    ctx.globalCompositeOperation = "lighter";
    const expression = clamp(
      (seconds - EXPRESSION.start) / (EXPRESSION.end - EXPRESSION.start),
    );
    updateMorph(expression);
    Object.values(FADE_WINDOWS).forEach(([start, end], index) => {
      const retainedLight = index === 2 ? 1 - 0.35 * smooth(seconds / 0.6) : 1;
      const brightness =
        retainedLight * (1 - smooth((seconds - start) / (end - start)));
      ctx.globalAlpha = brightness;
      ctx.drawImage(retreatLayers[index], SUBJECT.x, SUBJECT.y);
    });
    ctx.restore();
    drawTable();
  }
  function prepareFlightFrame() {
    const width = root.clientWidth, height = root.clientHeight;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    if (!flightLayout || flightLayout.width !== width || flightLayout.height !== height || flightPixelRatio !== pixelRatio) {
      flightLayout = createOpeningFlightLayout(width, height);
      flightPixelRatio = pixelRatio;
      flightCanvas.width = Math.round(width * pixelRatio);
      flightCanvas.height = Math.round(height * pixelRatio);
      flightContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      flightContext.imageSmoothingEnabled = true;
      flightContext.imageSmoothingQuality = 'high';
    }
    flightCanvas.hidden = false;
    flightContext.clearRect(0, 0, width, height);
    return flightLayout;
  }
  function flyingCard({ x, y, scale, angle }, alpha = 1) {
    flightContext.save();
    flightContext.globalAlpha = alpha;
    flightContext.translate(x, y);
    flightContext.rotate(angle);
    flightContext.scale(scale, scale);
    flightContext.shadowColor = "#0009";
    flightContext.shadowBlur = 20;
    flightContext.drawImage(
      plate,
      0,
      0,
      plate.naturalWidth,
      plate.naturalHeight,
      -OPENING_CARD.originX,
      -OPENING_CARD.originY,
      OPENING_CARD.width,
      OPENING_CARD.height,
    );
    flightContext.restore();
  }
  function drawFlight(progress) {
    drawDarkStage();
    const layout = prepareFlightFrame();
    if (!reduced && progress > 0.12 && progress < 0.86) {
      const strength =
        0.075 * Math.sin(Math.PI * clamp((progress - 0.12) / 0.74));
      for (let i = 3; i >= 1; i--) {
        const pose = openingFlightPose(layout, Math.max(0, progress - i * 0.018), reduced);
        flyingCard(pose, strength * (1 - i * 0.2));
      }
    }
    flyingCard(openingFlightPose(layout, progress, reduced), smooth(progress / 0.17));
  }
  function enterPhase(phase) {
    if (canvas.dataset.phase === phase) return;
    canvas.dataset.phase = phase;
    root.dataset.openingPhase = phase;
    if (phase === "spin") whoosh(DURATIONS.flight - 0.06, 0.28);
    if (phase === "covered") {
      if (!revealStarted) {
        revealStarted = true;
        Promise.resolve().then(onReveal).then(
          () => { revealPrepared = true; },
          () => { revealPrepared = true; },
        );
      }
      tone(115, 43, 0.35, 0.46);
      tone(240, 90, 0.12, 0.1);
    }
  }
  function transition() {
    if (!grinPlayed && elapsed >= EXPRESSION.start) {
      grinPlayed = true;
      openingAudio.grin();
    }
    if (elapsed < ENDS.retreat) {
      enterPhase("retreat");
      drawRetreat(elapsed);
      return;
    }
    if (elapsed < ENDS.darkPause) {
      enterPhase("dark-pause");
      drawDarkStage();
      return;
    }
    if (elapsed < ENDS.flight) {
      enterPhase("spin");
      drawFlight(clamp((elapsed - ENDS.darkPause) / DURATIONS.flight));
      return;
    }
    root.classList.add("revealing");
    ctx.clearRect(0, 0, 1672, 941);
    const layout = prepareFlightFrame();
    if (elapsed < ENDS.hold) {
      enterPhase("covered");
      flyingCard(openingRevealPose(layout, 0));
      return;
    }
    enterPhase("reveal");
    const progress = clamp((elapsed - ENDS.hold) / DURATIONS.reveal);
    flyingCard(openingRevealPose(layout, progress));
    if (progress >= 1) finish();
  }
  function finish() {
    if (state === "game") return;
    openingAudio.dispose();
    stopAudio();
    state = "game";
    ctx.clearRect(0, 0, 1672, 941);
    flightContext.clearRect(0, 0, flightLayout?.width || 0, flightLayout?.height || 0);
    flightCanvas.hidden = true;
    root.classList.add("revealing");
    canvas.dataset.phase = "game";
    root.dataset.openingPhase = 'game';
    status.textContent = "开场完成";

    pause.disabled = true;
    skipButton.hidden = true;
    unlockScrolling();
    onComplete();
  }
  function beginOriginal() {
    if (state !== "idle") return;
    root.dataset.sceneMode = "original-transition";
    openingAudio.start();
    if (reduced || loadFailed) { finish(); return; }
    unlockAudio();
    stopAudio();
    tone(88, 48, DURATIONS.retreat - 0.03, 0.23);
    captureRetreat();
    state = "transition";
    elapsed = 0;
    startButton.hidden = true;
    skipButton.hidden = false;

    pause.disabled = true;
    status.textContent = "开场播放中";
    root.classList.remove("revealing");
    canvas.dataset.phase = "ready";
    scheduleFrame();
  }
  const scene = createOpeningScene(root);
  const choice = createOpeningChoice(root, {
    reduced,
    onCamera: value => scene.setProgress(value),
    onStart: () => { unlockAudio(); onStart(); },
    onChoose: mode => { tone(230, 140, 0.12, 0.06); onModeSelect(mode); },
    onReturnToJoker: () => {
      state = "idle";
      beginOriginal();
    },
    onCancel: () => {
      state = "idle";
      startButton.hidden = false;
      pause.disabled = loadFailed;
      status.textContent = "等待开场";
      scheduleFrame();
    },
  });
  function begin() {
    if (state !== "idle") return;
    state = "choice";
    startButton.hidden = true;
    pause.disabled = true;
    status.textContent = "镜头移向牌桌";
    choice.open();
    scheduleFrame();
  }
  listen(skipButton, "click", () => {
    if (state === "transition") {
      stopAudio();
      finish();
    }
  });
  listen(document, "visibilitychange", () => {
    if (document.hidden) { openingAudio.suspend(); audioContext?.suspend().catch(() => {}); }
    else { openingAudio.resume(); audioContext?.resume().catch(() => {}); }
  });
  listen(startButton, "click", begin);
  listen(pause, "click", () => {
    playing = !playing;
    pause.textContent = playing ? "暂停呼吸" : "继续呼吸";
    scheduleFrame();
  });
  function scheduleFrame() {
    if (!raf && !disposed) {
      previous = 0;
      raf = requestAnimationFrame(tick);
    }
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    choice.dispose();
    scene.dispose();
    cancelAnimationFrame(raf);
    listeners.abort();
    unlockScrolling();
    openingAudio.dispose();
    stopAudio();
    audioContext?.close().catch(() => {});
    removalObserver.disconnect();
  }
  const removalObserver = new MutationObserver(() => {
    if (!root.isConnected) dispose();
  });
  removalObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  function tick(now) {
    raf = 0;
    if (!root.isConnected) {
      dispose();
      return;
    }
    const delta = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
    previous = now;
    if (!document.hidden) {
      if (state === "idle" && playing) time += delta;
      if (state === "transition") {
        elapsed += delta;
        // Keep the whole viewport covered if mounting the selected game takes
        // longer than the minimum hold, then resume from the same reveal pose.
        if (revealStarted && !revealPrepared)
          elapsed = Math.min(elapsed, ENDS.hold - 0.0001);
        if (playing && elapsed < DURATIONS.retreat) time += delta;
      }
    }
    if (state === "idle" || state === "choice") {
      if (!loadFailed) {
        buildPose();
        cover();
      } else {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, 1672, 941);
      }
      canvas.dataset.phase = state === "idle" ? "idle" : "choice";
    } else if (state === "transition") transition();
    // No idle work once the reveal finishes or breathing is paused.
    if (state === "transition" || state === "choice" || (state === "idle" && playing))
      raf = requestAnimationFrame(tick);
  }
  const load = (img) =>
    img.complete
      ? (img.naturalWidth ? Promise.resolve() : Promise.reject(new Error("Opening image unavailable")))
      : new Promise((resolve, reject) => {
          img.addEventListener("load", resolve, { once: true });
          img.addEventListener("error", reject, { once: true });
        });
  Promise.all([load(source), load(closed), load(plate), load(grinImage)])
    .then(() => {
      if (disposed) return;
      leftPatch = patch(750, 333);
      rightPatch = patch(912, 332);
      darknessMasks = buildDarknessMasks();
      morphFrames = buildMorphFrames();
      startButton.disabled = false;
      startButton.textContent = "开始游戏";
      pause.disabled = false;
      pause.textContent = playing ? "暂停呼吸" : "继续呼吸";
      scheduleFrame();
    })
    .catch(() => {
      if (disposed) return;
      status.textContent = "封面加载失败，仍可直接进入游戏";
      startButton.disabled = false;
      startButton.textContent = "进入游戏";
      loadFailed = true;
    });

  return dispose;
}
