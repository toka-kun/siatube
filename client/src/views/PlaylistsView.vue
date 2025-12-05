<template>
  <div class="playlists-container">
    <h1>再生リスト</h1>
    <!-- 内容は後で実装 -->
  </div>
</template>

<script>
export default {
  name: 'PlaylistsView'
};
</script>

<style scoped>
.playlists-container {
  padding: 24px;
  margin-left: 250px;
}

h1 {
  color: var(--text-primary);
  margin-bottom: 24px;
}

@media (max-width: 768px) {
  .playlists-container {
    margin-left: 200px;
  }
}
</style>
