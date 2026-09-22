<template>
  <div class="settings-overlay" @keydown.esc="$emit('close')" @click.self="$emit('close')">
    <div ref="dialog" class="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" @keydown.tab="trapFocus">
      <div class="settings-header">
        <h3 id="settings-title" class="settings-title">设置</h3>
        <button ref="closeButton" aria-label="关闭设置" class="settings-close" @click="$emit('close')">✕</button>
      </div>

      <div class="settings-body">
        <!-- BGM 音量 -->
        <div class="settings-row">
          <label class="settings-label">BGM 音量</label>
          <input
            type="range"
            min="0"
            max="100"
            v-model="localSettings.bgmVolume" aria-label="背景音乐音量"
            class="settings-slider"
            :disabled="localSettings.bgmMuted"
          />
          <span class="settings-value">{{ localSettings.bgmMuted ? '静音' : localSettings.bgmVolume + '%' }}</span>
          <label class="settings-toggle mute-toggle" title="BGM 静音">
            <input type="checkbox" v-model="localSettings.bgmMuted" aria-label="静音背景音乐" />
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
          </label>
        </div>

        <!-- SFX 音量 -->
        <div class="settings-row">
          <label class="settings-label">SFX 音量</label>
          <input
            type="range"
            min="0"
            max="100"
            v-model="localSettings.sfxVolume" aria-label="音效音量"
            class="settings-slider"
            :disabled="localSettings.sfxMuted"
          />
          <span class="settings-value">{{ localSettings.sfxMuted ? '静音' : localSettings.sfxVolume + '%' }}</span>
          <label class="settings-toggle mute-toggle" title="SFX 静音">
            <input type="checkbox" v-model="localSettings.sfxMuted" aria-label="静音音效" />
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
          </label>
        </div>

        <!-- 动画速度 -->
        <div class="settings-row settings-row-col">
          <label class="settings-label">动画速度</label>
          <div class="settings-radio-group">
            <label class="settings-radio" v-for="opt in speedOptions" :key="opt.value">
              <input
                type="radio"
                :value="opt.value"
                v-model="localSettings.animSpeed"
              />
              <span>{{ opt.label }}</span>
            </label>
          </div>
        </div>

        <!-- 显示公式预览 -->
        <div class="settings-row">
          <label class="settings-label">显示公式预览</label>
          <label class="settings-toggle">
            <input type="checkbox" v-model="localSettings.showFormula" aria-label="显示计分公式" />
            <span class="toggle-track">
              <span class="toggle-thumb"></span>
            </span>
          </label>
        </div>
      </div>

      <div class="settings-footer">
        <button class="px-btn btn-skip" @click="onSave">保存</button>
        <button class="px-btn btn-sort" @click="$emit('close')">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useDialogFocus } from '../composables/useDialogFocus.js'
const dialog = ref(null), closeButton = ref(null)
const { trapFocus } = useDialogFocus(dialog, closeButton)

const props = defineProps({
  settings: { type: Object, required: true },
})

const emit = defineEmits(['close', 'save'])

const localSettings = ref({ ...props.settings })

const speedOptions = [
  { value: 1.5, label: '慢' },
  { value: 1.0, label: '普通' },
  { value: 0.6, label: '快' },
]

function onSave() {
  emit('save', { ...localSettings.value })
  emit('close')
}
</script>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}

.settings-modal {
  background: linear-gradient(145deg, #20372a, #101d16);
  border: 2px solid rgba(173, 147, 85, 0.5);
  border-radius: 4px;
  padding: 24px;
  width: min(500px, calc(100vw - 30px));
  box-shadow: 0 20px 60px rgba(0,0,0,0.6);
  animation: modal-appear 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes modal-appear {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.settings-title {
  font-family: 'Inter', 'PingFang SC', sans-serif;
  font-size: 18px;
  font-weight: 800;
  color: #fff;
}

.settings-close {
  background: none;
  border: none;
  color: rgba(255,255,255,0.5);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.15s;
}

.settings-close:hover {
  background: rgba(255,255,255,0.1);
  color: #fff;
}

.settings-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.settings-row-col {
  flex-direction: column;
  align-items: flex-start;
}

.settings-label {
  font-size: 14px;
  font-weight: 700;
  color: rgba(255,255,255,0.7);
  min-width: 110px;
}

.settings-slider {
  flex: 1;
  accent-color: var(--sb-blue);
}

.settings-value {
  font-family: Georgia, serif;
  font-size: 20px;
  color: var(--gold);
  min-width: 40px;
  text-align: right;
}

.settings-radio-group {
  display: flex;
  gap: 16px;
  margin-top: 6px;
}

.settings-radio {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: rgba(255,255,255,0.7);
  cursor: pointer;
}

.settings-radio input {
  accent-color: var(--sb-blue);
}

/* Toggle */
.settings-toggle {
  cursor: pointer;
  display: flex;
  align-items: center;
}

.settings-toggle input {
  position: absolute;
  opacity: 0;
  width: 44px;
  height: 24px;
}

.toggle-track {
  width: 44px;
  height: 24px;
  background: rgba(255,255,255,0.15);
  border-radius: 4px;
  position: relative;
  transition: background 0.2s;
}

.settings-toggle input:checked + .toggle-track {
  background: var(--sb-blue);
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}

.settings-toggle input:checked + .toggle-track .toggle-thumb {
  transform: translateX(20px);
}

.settings-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 20px;
}
.settings-toggle input:focus-visible + .toggle-track { outline: 2px solid var(--gold); outline-offset: 3px; }
@media(max-width:500px) { .settings-modal { padding: 18px; } .settings-row { gap: 8px; flex-wrap: wrap; } .settings-label { min-width: 90px; } }
</style>
