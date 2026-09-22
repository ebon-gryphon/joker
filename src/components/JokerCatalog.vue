<template>
  <div class="catalog-backdrop" @click.self="$emit('close')" @keydown.esc="$emit('close')">
    <section ref="dialog" class="catalog" @keydown.tab="trapFocus" role="dialog" aria-modal="true" aria-labelledby="catalog-title">
      <header><div><h2 id="catalog-title">小丑牌图鉴 · {{ JOKER_POOL.length }}</h2><p>筹码 × 倍率 · 从左到右结算 · 以不同组合构筑你的打法</p></div><button ref="closeButton" class="px-btn" @click="$emit('close')">关闭</button></header>
      <div class="filters">
        <input v-model="query" aria-label="搜索小丑牌" placeholder="搜索名称或效果…" />
        <select v-model="category" aria-label="筛选流派"><option value="">全部流派</option><option v-for="value in categories" :key="value">{{ value }}</option></select>
        <select v-model="rarity" aria-label="筛选稀有度"><option value="">全部稀有度</option><option v-for="(label, key) in rarities" :key="key" :value="key">{{ label }}</option></select>
      </div>
      <p class="rules">所有牌面条件检查「打出的牌」。成长跨关保留，重新开局清零。普通 / 稀有 / 传说按关卡权重进店，传说从第 3 关后的商店开始出现。</p>
      <div class="catalog-grid">
        <article v-for="j in filtered" :key="j.id" :class="j.rarity">
          <JokerArt :joker="j" lazy />
          <div class="card-top"><span>{{ rarities[j.rarity] }} · ${{ j.price }}</span></div>
          <h3>{{ j.name }} <small v-if="ownedIds.has(j.id)">已拥有</small></h3>
          <div class="category">{{ j.category }}</div><p>{{ j.desc }}</p>
        </article>
      </div>
      <p v-if="!filtered.length">没有符合条件的小丑牌。</p>
      <footer>显示 {{ filtered.length }} / {{ JOKER_POOL.length }} 张 · 先补筹码和加倍率，再将乘倍率牌放到右侧。</footer>
    </section>
  </div>
</template>
<script setup>
import JokerArt from './JokerArt.vue'
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { JOKER_POOL } from '../composables/jokerCatalog.js'
const props = defineProps({ jokers: { type: Array, default: () => [] } })
defineEmits(['close'])
const query = ref(''), category = ref(''), rarity = ref(''), closeButton = ref(null)
const dialog = ref(null)
function trapFocus(event) {
  const controls = [...dialog.value.querySelectorAll('button, input, select')]
  const first = controls[0], last = controls.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}
const previousFocus = document.activeElement
onMounted(() => closeButton.value?.focus())
onUnmounted(() => previousFocus?.focus())
const rarities = { common: '普通', rare: '稀有', legendary: '传说' }
const categories = [...new Set(JOKER_POOL.map(j => j.category))]
const ownedIds = computed(() => new Set(props.jokers.map(j => j.id)))
const filtered = computed(() => JOKER_POOL.filter(j => (!category.value || j.category === category.value) && (!rarity.value || j.rarity === rarity.value) && `${j.name}${j.desc}`.includes(query.value.trim())))
</script>
<style scoped>
.catalog-backdrop { position: fixed; inset: 0; z-index: 300; background: #050b07dd; display: grid; place-items: center; padding: 24px; }
.catalog { width: min(1040px, 100%); max-height: 90vh; overflow: auto; padding: 28px; border: 1px solid #857247; border-radius: 4px; background: #142119; color: #eee3c9; box-shadow: 0 24px 80px #0008; }
header, .filters, .card-top { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
h2 { margin: 0; font-size: 24px; } header p, .rules, footer { color: #b9ad90; font-size: 13px; line-height: 1.7; }
.filters { margin: 20px 0 12px; flex-wrap: wrap; justify-content: flex-start; }
input, select { padding: 11px 14px; background: #203127; border: 1px solid #857247; border-radius: 3px; color: white; font: inherit; } input { flex: 1; min-width: 180px; }
.catalog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 14px; margin: 20px 0; }
article { padding: 16px; border: 1px solid #6cb4d366; border-radius: 4px; background: linear-gradient(140deg, #293b2c, #18271e); }
article.rare { border-color: #e34b6f; } article.legendary { border-color: #b577ff; }
.card-top { margin-top: 12px; font-size: 12px; color: #c4b79a; } h3 { font-size: 16px; margin: 14px 0 8px; } small { font-size: 10px; color: #8fdfa8; } .category { font-size: 11px; color: #ffc857; } article p { font-size: 13px; line-height: 1.7; margin-bottom: 0; }
</style>
