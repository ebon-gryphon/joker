<template>
  <div class="settings-overlay" @click.self="$emit('close')">
    <div class="settings-modal">
      <div class="settings-header">
        <h3 class="settings-title">⚙️ 设置</h3>
        <button class="settings-close" @click="$emit('close')">✕</button>
      </div>

      <div class="settings-body">
        <!-- BGM 音量 -->
        <div class="settings-row">
          <label class="settings-label">BGM 音量</label>
          <input
            type="range"
            min="0"
            max="100"
            v-model="localSettings.bgmVolume"
            class="settings-slider"
          />
          <span class="settings-value">{{ localSettings.bgmVolume }}%</span>
        </div>

        <!-- SFX 音量 -->
        <div class="settings-row">
          <label class="settings-label">SFX 音量</label>
          <input
            type="range"
            min="0"
            max="100"
            v-model="localSettings.sfxVolume"
            class="settings-slider"
          />
          <span class="settings-value">{{ localSettings.sfxVolume }}%</span>
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
            <input type="checkbox" v-model="localSettings.showFormula" />
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
import { ref, watch } from 'vue'

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
  background: linear-gradient(145deg, #1a2858, #0d1b40);
  border: 2px solid rgba(74, 107, 255, 0.4);
  border-radius: 16px;
  padding: 24px;
  min-width: 380px;
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
  font-family: 'VT323', monospace;
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
  display: none;
}

.toggle-track {
  width: 44px;
  height: 24px;
  background: rgba(255,255,255,0.15);
  border-radius: 12px;
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
</style>
