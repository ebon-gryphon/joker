<template>
  <div class="scene-cover-props" aria-hidden="true" :style="{ '--prop-source': `url(${base}opening/source.jpg)` }">
    <div
      v-for="prop in tableProps"
      :key="prop.id"
      :data-cover-prop="prop.id"
      :data-source-x="prop.x"
      :data-source-y="prop.y"
      :data-source-width="prop.width"
      :data-source-height="prop.height"
      class="scene-prop"
      :style="{
        width: `${prop.width}px`,
        height: `${prop.height}px`,
        backgroundPosition: `${-prop.x}px ${-prop.y}px`,
        clipPath: prop.mask,
      }"
    ></div>
  </div>
</template>

<script setup>
const base = import.meta.env.BASE_URL

// Preserve the original props above the cover's blended felt edge, then bridge
// the first few camera degrees. Physical furniture takes over by 22 degrees.
const tableProps = [
  {
    id: 'red-chip-stack', x: 60, y: 805, width: 165, height: 113,
    mask: 'polygon(49px 10px,109px 9px,131px 14px,144px 18px,147px 24px,147px 80px,141px 91px,150px 96px,159px 100px,159px 105px,145px 111px,87px 112px,33px 108px,8px 101px,3px 94px,17px 87px,33px 84px,35px 30px,39px 19px)',
  },
  {
    id: 'green-chip-stack', x: 205, y: 834, width: 145, height: 85,
    mask: 'polygon(38px 15px,85px 14px,110px 18px,124px 23px,131px 27px,133px 65px,128px 73px,135px 76px,137px 82px,111px 85px,43px 84px,9px 79px,4px 74px,16px 66px,17px 29px,25px 21px)',
  },
  {
    id: 'single-red-chip', x: 330, y: 883, width: 169, height: 58,
    mask: 'polygon(43px 17px,84px 14px,108px 17px,131px 22px,141px 28px,144px 43px,151px 45px,160px 51px,156px 58px,25px 58px,7px 51px,1px 43px,17px 36px,19px 27px,28px 21px)',
  },
  {
    id: 'card-stack', x: 1125, y: 839, width: 345, height: 102,
    mask: 'polygon(142px 17px,177px 16px,191px 19px,199px 24px,207px 24px,207px 27px,222px 33px,239px 37px,251px 43px,266px 49px,279px 54px,299px 61px,317px 65px,330px 68px,333px 75px,325px 79px,335px 82px,341px 87px,334px 96px,292px 102px,121px 102px,111px 96px,101px 92px,92px 88px,80px 82px,68px 75px,56px 68px,45px 61px,33px 53px,23px 46px,20px 38px,21px 29px,64px 25px,64px 22px,141px 22px)',
  },
]
</script>

<style scoped>
.scene-cover-props {
  position: absolute;
  inset: 0;
  width: 1672px;
  height: 941px;
  pointer-events: none;
  opacity: var(--cover-prop-opacity, 1);
}
.scene-prop {
  position: absolute;
  left: 0;
  top: 0;
  background-image: var(--prop-source);
  background-size: 1672px 941px;
  background-repeat: no-repeat;
  transform-origin: 50% 50%;
  pointer-events: none;
}
</style>
