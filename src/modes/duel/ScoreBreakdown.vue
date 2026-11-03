<script setup>
import ScoreBreakdown from '../../components/ScoreBreakdown.vue'
defineProps({ result: { type: Object, required: true }, cards: { type: Array, required: true }, title: { type: String, default: '本手怎么算的' } })
</script>
<template><ScoreBreakdown :result="result" :cards="cards" :title="title" /></template>
