<template>
  <span class="brand"><span class="brand-symbol" aria-hidden="true"><i></i><i></i><i></i></span><span>knct<span class="brand-slash">/</span>signa<span class="brand-dot">.</span></span></span>
</template>

<style>
.brand { display: inline-flex; align-items: center; gap: 12px; font-size: 24px; font-weight: 750; letter-spacing: -.8px; white-space: nowrap; }
.brand-symbol { display: flex; align-items: center; justify-content: center; gap: 3px; width: 34px; height: 34px; background: #d9f99a; border-radius: 10px; transform: rotate(-2deg); }
.brand-symbol i { width: 3px; height: 14px; border-radius: 2px; background: #1b2720; transform: skew(-17deg); }
.brand-symbol i:nth-child(2) { height: 20px; }
.brand-slash { margin: 0 4px; color: #818a80; font-weight: 400; }
.brand-dot { color: #a5c76b; }
</style>
