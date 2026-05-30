<template>
  <div
    class="card-view"
    :class="{
      selected: isSelected,
      'suit-red': card.suit === '♥' || card.suit === '♦',
      'suit-black': card.suit === '♠' || card.suit === '♣',
    }"
    @click="$emit('click', card)"
  >
    <div class="card-corner card-corner-tl">
      <div class="card-rank">{{ card.rank }}</div>
      <div class="card-suit-small">{{ card.suit }}</div>
    </div>
    <div class="card-center">{{ card.suit }}</div>
    <div class="card-corner card-corner-br">
      <div class="card-rank">{{ card.rank }}</div>
      <div class="card-suit-small">{{ card.suit }}</div>
    </div>
    <div v-if="isSelected" class="card-selected-indicator"></div>
  </div>
</template>

<script setup>
defineProps({
  card: { type: Object, required: true },
  isSelected: { type: Boolean, default: false },
})
defineEmits(['click'])
</script>

<style scoped>
.card-view {
  width: 100px;
  height: 145px;
  border-radius: 10px;
  background: linear-gradient(145deg, #ffffff, #f0f0f0);
  border: 2px solid #ccc;
  position: relative;
  cursor: pointer;
  user-select: none;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: visible;
}

.card-view:hover {
  transform: translateY(-6px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
}

.card-view.selected {
  transform: translateY(-18px);
  border-color: #4dd6ff;
  box-shadow: 0 0 16px #4dd6ff, 0 0 32px rgba(77, 214, 255, 0.4);
}

.card-corner {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.1;
}

.card-corner-tl {
  top: 6px;
  left: 8px;
}

.card-corner-br {
  bottom: 6px;
  right: 8px;
  transform: rotate(180deg);
}

.card-rank {
  font-family: 'Inter', 'PingFang SC', sans-serif;
  font-size: 16px;
  font-weight: 800;
  line-height: 1;
}

.card-suit-small {
  font-size: 12px;
  line-height: 1;
}

.card-center {
  font-size: 36px;
  line-height: 1;
}

.suit-red .card-rank,
.suit-red .card-suit-small,
.suit-red .card-center {
  color: #dc2626;
}

.suit-black .card-rank,
.suit-black .card-suit-small,
.suit-black .card-center {
  color: #1a1a2e;
}

.card-selected-indicator {
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4dd6ff;
  box-shadow: 0 0 8px #4dd6ff;
}
</style>
