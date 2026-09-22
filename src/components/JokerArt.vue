<template>
  <img
    class="joker-illustration"
    :src="`${baseUrl}jokers/${joker.id}.png`"
    :alt="`${joker.name}卡面`"
    :loading="lazy ? 'lazy' : 'eager'"
    decoding="async"
    width="512"
    height="768"
  />
</template>

<script setup>
defineProps({
  joker: { type: Object, required: true },
  lazy: Boolean,
})
const baseUrl = import.meta.env.BASE_URL
</script>

<style scoped>
.joker-illustration {
  display: block;
  width: 100%;
  height: auto;
  aspect-ratio: 2 / 3;
  object-fit: contain;
  background: #e7d4ac;
  border-radius: 6px;
}
</style>
