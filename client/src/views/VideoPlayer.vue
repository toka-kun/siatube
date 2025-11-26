<template>
  <div class="page-container">
    <div class="main-content" v-if="video">
      <div class="video-wrapper">
        <StreamPlayer :videoId="videoId" :streamType="resolvedStreamType" @ended="onPlayerEnded" @play-autoplay-candidate="onPlayAutoplayCandidate" @autoplay-no-suitable-video="onAutoplayNoSuitableVideo" />
      </div>

      <h1 class="video-title" ref="videoTitle">{{ title }}</h1>
      <div class="video-info channel-info">
        <router-link :to="`/channel/${authorId}`" class="channel-icon-link">
          <img
            :src="authorThumbnailUrl"
            alt="チャンネルアイコン"
            class="channel-icon"
            @error="onImageError($event, authorId)"
          />
        </router-link>
        <div class="channel-text">
          <router-link :to="`/channel/${authorId}`" class="channel-name">
            {{ authorName }}
          </router-link>
          <p class="subscriber-count">{{ subscriberCount }}</p>
        </div>

        <div
          class="custom-dropdown"
          @click="toggleDropdown"
          style="margin-left: auto"
        >
          <span class="custom-dropdown-label">
            {{
              !resolvedStreamType
                ? "再生出来ない場合"
                : resolvedStreamType === "1"
                ? "ブロックされた場合はこちら"
                : resolvedStreamType === "2"
                ? "再生モード：タイプ２"
                : "再生出来ない場合"
            }}
            <span class="dropdown-ending">▼</span>
          </span>

          <div v-if="isDropdownOpen" class="custom-dropdown-menu">
            <div
              class="custom-dropdown-item"
              @click.stop="selectStreamType('1')"
            >
              通常
            </div>
            <div
              class="custom-dropdown-item"
              @click.stop="selectStreamType('2')"
              style="color: red;"
            >
              再生できない場合こちら
            </div>
          </div>
        </div>
      </div>
      <div
        style="
          padding: 10px 10px 0 10px;
          border-radius: 8px;
          background-color: rgba(0, 0, 0, 0.05);
        "
      >
        <div class="video-meta">
          <span>{{ viewCount.replace(/\s+/g, '') }}</span>・
          <span>高評価数{{ likeCount }}</span>
          <span class="dot">　</span>
          <span>{{ relativeDate }}</span>
          <div style="padding-top: 10px;">
            <StreamPlayer :videoId="videoId" :streamType="'3'" />
          </div>
        </div>
        <div class="video-description">
          <div v-if="!showFullDescription" class="description-preview">
            <p v-if="descriptionRun0">{{ descriptionRun0 }}</p>
            <p v-if="descriptionRun1">{{ descriptionRun1 }}</p>
          </div>
          <div
            v-else
            class="description-full"
            v-html="formattedDescription"
          ></div>

          <span
            class="description-toggle"
            role="button"
            tabindex="0"
            @click="toggleDescription"
            @keydown.enter="toggleDescription"
            @keydown.space.prevent="toggleDescription"
          >
            {{ showFullDescription ? "一部を表示" : "...もっと見る" }}
          </span>
        </div>
      </div>
      <Comment :videoId="videoId" />
    </div>

    <aside v-if="relatedVideos.length" class="related-section">
      <PlaylistComponent
        v-if="playlistId"
        displayType="watch"
        :playlistId="playlistId"
        :playVideoId="videoId"
      />
      <h3 class="related-title">関連動画</h3>
      <ul class="related-list">
        <li
          v-for="r in relatedVideos"
          :key="r.videoId"
          class="related-item"
          :data-video-id="r.videoId"
          :data-duration="`${r.duration}`"
          @mouseenter="hoverId = r.videoId"
          @mouseleave="hoverId = null"
        >
          <router-link v-if="r.videoId" :to="r.replaylistId && r.replaylistId.length > 20 ? `/watch?v=${r.videoId}&list=${r.replaylistId}` : `/watch?v=${r.videoId}`" class="page-link">
            <div class="thumb-wrapper">
              <img
                v-if="hoverId !== r.videoId || !r.previewUrl"
                :src="'data:image/jpeg;base64,' + r.base64imge"
                :alt="r.title"
                class="thumb-img"
                @error="onImageError($event, r.videoId)"
              />
              <span
                v-if="r.badge"
                class="duration-badge"
                :class="{
                  'badge-live': r.badge.toLowerCase().includes('ライブ'),
                }"
              >
                {{ r.badge }} <!-- duration: {{ r.duration }}s -->
              </span>
            </div>
          </router-link>
          <router-link v-if="r.videoId" :to="r.replaylistId && r.replaylistId.length > 20 ? `/watch?v=${r.videoId}&list=${r.replaylistId}` : `/watch?v=${r.videoId}`" class="page-link">
            <div class="video-info">
              <span class="video-title-related" :title="r.title">{{ r.title }}</span>
              <div class="video-metadata">
                <div class="one-line re-actername">{{ r.metadataRow1 }}</div>
                <span v-if="r.metadataRow2Part1 && r.metadataRow2Part1.replace(/\s+/g, '') !== '本日更新'">{{ r.metadataRow2Part1.replace(/\s+/g, '') === '再生リストの全体を見る' ? '再生リスト' : r.metadataRow2Part1.replace(/\s+/g, '') }}</span>
                <span v-if="r.metadataRow2Part2 && r.metadataRow2Part2.replace(/\s+/g, '')" class="dot">・</span>{{ r.metadataRow2Part2 ? r.metadataRow2Part2.replace(/\s+/g, '') : '' }}
              </div>
            </div>
          </router-link>
        </li>
      </ul>
    </aside>
    <div v-else-if="error" class="error-msg">
      ⚠️ {{ error }}<br>
      <button class="reload-btn" @click="reloadVideo">再取得</button>
    </div>
    <p v-else class="loading-msg">読み込み中...<br>読み込む速度を早くする方法。↓<br>右上の設定マークからカスタムエンドポイントのを追加してください　＊方法は簡単で1~3分で作れます。</p>

    <!-- 自動再生フィルタ通知 -->
    <div v-if="showAutoplayNotification" class="autoplay-notification">
      <span class="notification-text">{{ autoplayNotificationMessage }}</span>
      <button class="notification-close" @click="showAutoplayNotification = false">×</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import { ref } from 'vue';
import PlaylistComponent from "@/components/Playlist.vue";
import Comment from "@/components/Comment.vue";
import StreamPlayer from "@/components/StreamPlayer.vue";
window.scrollTo(0, 0);

const route = useRoute();
const videoId = computed(() => route.query.v);
const playlistId = computed(() => route.query.list);

const currentType = ref('1');

function switchStream() {
  currentType.value = '3';
}
</script>

<script>
import { apiRequest } from "@/services/requestManager";

export default {
  props: {
    videoId: { type: String, required: true },
    streamType: { type: String, default: "" },
  },
  data() {
    return {
      video: null,
      error: null,
      hoverId: null,
      showFullDescription: false,
      localStreamType: this.getDefaultPlaybackMode() || "1",
      isDropdownOpen: false,
      _autoplayTimer: null,
      _autoplayDecisionTimer: null,
      showAutoplayNotification: false,
      autoplayNotificationMessage: "",
    };
  },
  computed: {
    resolvedStreamType() {
      return this.streamType || this.localStreamType;
    },
    viewCount() {
      return this.video?.views || "情報なし";
    },
    title() {
      return this.video?.title || "情報なし";
    },
    relativeDate() {
      return this.video?.relativeDate || "";
    },
    likeCount() {
      return this.video?.likes || "情報なし";
    },
    subscriberCount() {
      return this.video?.author?.subscribers || "情報なし";
    },
    authorId() {
      return this.video?.author?.id || "情報なし";
    },
    authorName() {
      return this.video?.author?.name || "情報なし";
    },
    authorThumbnailUrl() {
      return this.video?.author?.thumbnail || "情報なし";
    },
    descriptionText() {
      return this.video?.description?.text || "情報なし";
    },
    formattedDescription() {
      const rawText =
        this.video?.description?.text ||
        "この動画には説明が追加されていません。";
      return rawText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");
    },
    shouldShowToggle() {
      const text = this.descriptionRun3?.trim();
      return text !== "";
    },
    descriptionRun0() {
      return this.video?.description?.run0 || "情報なし";
    },
    descriptionRun1() {
      return this.video?.description?.run1 || "";
    },
    descriptionRun2() {
      return this.video?.description?.run2 || "";
    },
    descriptionRun3() {
      return this.video?.description?.run3 || "";
    },
    relatedVideos() {
      const feed = this.video?.related || [];
      const mapped = feed.map((item) => {
        // Try to extract duration from badge (e.g., "1:23:45" or "4:30")
        let duration = item.duration || 0;
        if (!duration && item.badge) {
          duration = this.parseDurationFromBadge(item.badge);
        }
        return {
          base64imge: item.thumbnail || "",
          badge: item.badge || "",
          title: item.title || "",
          metadataRow1: item.channel,
          metadataRow2Part1: item.views || "",
          metadataRow2Part2: item.uploaded || "",
          videoId: item.videoId || "",
          replaylistId: item.playlistId || "",
          duration: duration,
        };
      });
      
      // Debug: log the first item to see what data we have
      if (mapped.length > 0) {
        console.log("First related video item:", mapped[0]);
        console.log("Raw API response first item:", feed[0]);
      }
      
      return mapped;
    },
  },
  methods: {
    getDefaultPlaybackMode() {
      try {
        // localStorage を優先的に読む（沙箱環境での Cookie 制限に対応）
        const fromStorage = localStorage.getItem("defaultPlaybackMode");
        if (fromStorage) {
          return fromStorage;
        }
        // localStorage にない場合は Cookie から取得
        const match = document.cookie.match(
          new RegExp("(^| )StreamType=([^;]+)")
        );
        return match ? decodeURIComponent(match[2]) : null;
      } catch {
        return null;
      }
    },
    getCookieSafe(name) {
      try {
        const match = document.cookie.match(
          new RegExp("(^| )" + name + "=([^;]+)")
        );
        return match ? decodeURIComponent(match[2]) : null;
      } catch {
        return null;
      }
    },
    parseDurationFromBadge(badgeText) {
      // Try to parse duration from badge text like "1:23:45" or "4:30" or "4分"
      if (!badgeText || typeof badgeText !== 'string') return 0;
      
      badgeText = badgeText.trim();
      console.log(`Parsing badge: "${badgeText}"`);
      
      // Pattern 1: HH:MM:SS format
      const hhmmssMatch = badgeText.match(/^(\d+):(\d+):(\d+)$/);
      if (hhmmssMatch) {
        const seconds = parseInt(hhmmssMatch[1]) * 3600 + parseInt(hhmmssMatch[2]) * 60 + parseInt(hhmmssMatch[3]);
        console.log(`  HH:MM:SS matched: ${seconds}s`);
        return seconds;
      }
      
      // Pattern 2: MM:SS format
      const mmssMatch = badgeText.match(/^(\d+):(\d+)$/);
      if (mmssMatch) {
        const seconds = parseInt(mmssMatch[1]) * 60 + parseInt(mmssMatch[2]);
        console.log(`  MM:SS matched: ${seconds}s`);
        return seconds;
      }
      
      // Pattern 3: Japanese format like "4分" or "4分30秒"
      const japaneseMatch = badgeText.match(/^(\d+)分(?:(\d+)秒)?$/);
      if (japaneseMatch) {
        let seconds = parseInt(japaneseMatch[1]) * 60;
        if (japaneseMatch[2]) {
          seconds += parseInt(japaneseMatch[2]);
        }
        console.log(`  Japanese format matched: ${seconds}s`);
        return seconds;
      }
      
      console.log(`  No pattern matched`);
      return 0;
    },
    setCookieSafe(name, value, seconds) {
      try {
        const expires = new Date(Date.now() + seconds * 1000).toUTCString();
        document.cookie = `${name}=${encodeURIComponent(
          value
        )}; expires=${expires}; path=/`;
      } catch {}
    },
    onStreamTypeChange() {
      // localStorage と Cookie の両方に保存
      try {
        localStorage.setItem("defaultPlaybackMode", this.localStreamType);
      } catch (e) {
        console.error("localStorage save error:", e);
      }
      this.setCookieSafe("StreamType", this.localStreamType, 99999);
    },
    onPlayerEnded() {
      try {
        // 既存のタイマーをクリア
        try { if (this._autoplayTimer) { clearTimeout(this._autoplayTimer); this._autoplayTimer = null; } } catch (e) {}
        try { if (this._autoplayDecisionTimer) { clearTimeout(this._autoplayDecisionTimer); this._autoplayDecisionTimer = null; } } catch (e) {}

        // 少し待って（他のイベントが到着するのを待つ）から遷移タイマーをセット
        this._autoplayDecisionTimer = setTimeout(() => {
          try {
            // 自動再生ロックがある場合はスケジュールを抑止
            const lockRaw = (() => { try { return sessionStorage.getItem('yt_autoplay_lock'); } catch (e) { return null; } })();
            if (lockRaw) {
              try {
                const lock = JSON.parse(lockRaw);
                if (lock && lock.expires && Date.now() < lock.expires) {
                  // ロック期間内はスケジュールを行わない
                  return;
                }
              } catch (e) {}
            }

            // フィルターが有効な場合はフォールバック処理をしない
            // （StreamType2 の自動再生イベントに任せる。条件に合う動画がなければ onAutoplayNoSuitableVideo が呼ばれる）
            const filterConfig = window.__autoplayDurationFilter || { enabled: false };
            if (filterConfig.enabled) {
              // フィルターが有効な場合、StreamType2 の候補選択イベントを待つ
              // 候補がない場合は onAutoplayNoSuitableVideo が呼ばれる
              return;
            }

            // フィルターが無効な場合のみフォールバック処理（最初の関連動画を再生）
            // 決定後、元の3秒遅延で遷移をセット
            this._autoplayTimer = setTimeout(() => {
              const next =
                this.relatedVideos && this.relatedVideos.length
                  ? this.relatedVideos[0]
                  : null;
              if (next && next.videoId) {
                const query = { v: next.videoId, autoplay: "1" };
                if (next.replaylistId && next.replaylistId.length > 20)
                  query.list = next.replaylistId;
                this.$router.push({ path: "/watch", query });
              }
            }, 3000);
          } catch (e) {
            console.error('autoplay decision error', e);
          }
        }, 300); // 300ms の短い待ち時間
      } catch (e) {
        console.error("onPlayerEnded error", e);
      }
    },

    onPlayAutoplayCandidate({ id }) {
      try {
        if (!id) return;
        // 自動遷移中の競合を防ぐためロックを設定（短時間）
        try {
          const lock = { target: id, expires: Date.now() + 5000 };
          sessionStorage.setItem('yt_autoplay_lock', JSON.stringify(lock));
        } catch (e) {}

        // 決定タイマーや既存の自動遷移タイマーをクリアしてから遷移
        try { if (this._autoplayDecisionTimer) { clearTimeout(this._autoplayDecisionTimer); this._autoplayDecisionTimer = null; } } catch (e) {}
        try { if (this._autoplayTimer) { clearTimeout(this._autoplayTimer); this._autoplayTimer = null; } } catch (e) {}

        const query = { v: id };
        this.$router.push({ path: "/watch", query });
      } catch (e) {
        console.error("onPlayAutoplayCandidate error", e);
      }
    },

    onAutoplayNoSuitableVideo() {
      try {
        const filterConfig = window.__autoplayDurationFilter || { enabled: false, minutes: 4 };
        this.autoplayNotificationMessage = `指定条件（${filterConfig.minutes}分以下）に合う関連動画がないため、自動再生をストップしました。`;
        this.showAutoplayNotification = true;

        // 5秒後に自動で通知を非表示
        setTimeout(() => {
          this.showAutoplayNotification = false;
        }, 5000);
      } catch (e) {
        console.error("onAutoplayNoSuitableVideo error:", e);
      }
    },

    // --- fetchのみ（JSONのみ対応）
    async fetchVideoData(id) {
      const maxRetries = 3;
      if (!id) {
        this.video = null;
        this.error = "動画IDが指定されていません。";
        return;
      }

      try {
        this.video = null;
        this.error = null;
        // requestManager の apiRequest を使って中央集約されたリクエストを実行
        const data = await apiRequest({
          params: { video: id },
          method: "GET",
          retries: maxRetries,
          timeout: 15000,
        });

        this.video = data;
        if (!Array.isArray(data.related) || data.related.length === 0) {
          this.error = "関連動画が見つかりませんでした。";
        }
        return;
      } catch (err) {
        console.error("fetchVideoData error:", err);
        this.video = null;
        // エラーメッセージは既存の UI 用文字列を使う
        this.error =
          err && err.message && err.message !== ""
            ? err.message
            : "動画情報を取得できませんでした。";
      }
    },
    reloadVideo() {
      this.fetchVideoData(this.videoId);
    },
    getPrimaryThumbnail(id) {
      return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    },
    onImageError(event, id) {
      if (!event.target.dataset.error) {
        event.target.src = `https://i.ytimg.com/vi/${id}/sddefault.jpg`;
        event.target.dataset.error = true;
      }
    },
    toggleDescription() {
      this.showFullDescription = !this.showFullDescription;
      this.$nextTick(() => {
        const el = this.$refs.videoTitle;
        if (el?.scrollIntoView) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    },
    toggleDropdown() {
      this.isDropdownOpen = !this.isDropdownOpen;
    },
    selectStreamType(value) {
      this.localStreamType = value;
      this.isDropdownOpen = false;
      this.onStreamTypeChange();
    },
    handleClickOutside(event) {
      if (this.isDropdownOpen && !this.$el.contains(event.target)) {
        this.isDropdownOpen = false;
      }
    },
    handleEscape(event) {
      if (event.key === "Escape") {
        this.isDropdownOpen = false;
      }
    },
  },
  mounted() {
    document.addEventListener("click", this.handleClickOutside);
    document.addEventListener("keydown", this.handleEscape);
  },
  beforeUnmount() {
    document.removeEventListener("click", this.handleClickOutside);
    document.removeEventListener("keydown", this.handleEscape);
    if (this._autoplayTimer) {
      clearTimeout(this._autoplayTimer);
      this._autoplayTimer = null;
    }
  },
  watch: {
    videoId: {
      immediate: true,
      handler(newId) {
        this.fetchVideoData(newId);
      },
    },
    title(newTitle) {
      if (newTitle && newTitle !== "情報なし") {
        document.title = newTitle;
      }
    },
  },
};
</script>


<style scoped>
.dropdown-ending {
  display: inline-block;
  font-size: 1rem;
  margin-block-start: 0px;
  margin-block-end: 0px;
  margin-inline-start: 0px;
  margin-inline-end: 0px;
  display: inline-block;
  margin-top: -1rem;
  margin-bottom: -0.5rem;
  margin-left: 1rem;
}

.custom-dropdown {
  position: relative;
  background: #ffff3579;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  user-select: none;
  width: max-content;
  font-size: 0.9rem;
}

.custom-dropdown-label {
  white-space: nowrap;
}

.re-actername{
  margin-bottom: 3px;
  font-size: 0.8rem;
}

.custom-dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 0.25rem;
  background: white;
  border: 1px solid #ccc;
  border-radius: 6px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  min-width: 100%;
  white-space: nowrap;
  max-width: max-content;
}

.custom-dropdown-item {
  padding: 0.5rem 1rem;
  cursor: pointer;
}

.custom-dropdown-item:hover {
  background-color: #eee;
}

.one-line {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 180px;
}

p {
  margin-block-start: 1em;
  margin-block-end: 0.8em;
  margin-inline-start: 0px;
  margin-inline-end: 0px;
  unicode-bidi: isolate;
}
.channel-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.page-link {
  text-decoration: none;
}
.channel-icon-link {
  flex-shrink: 0;
  display: block;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
}

.channel-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  border-radius: 50%;
}

.channel-text {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.channel-name {
  font-weight: 500;
  font-size: 1.1rem;
  color: #030303;
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.channel-name:hover,
.channel-name:focus {
  text-decoration: underline;
}

.subscriber-count {
  font-size: 0.85rem;
  color: #606060;
  margin: 2px 0 0 0;
  white-space: nowrap;
}
.video-info p {
  font-size: 0.8rem;
  color: #606060;
  margin: 0 0 4px 0;
  line-height: 1.4;
  font-weight: 400;
}
.video-description {
  font-size: 0.9rem;
  color: #030303;
  line-height: 1.5;
  margin-top: 12px;
  margin-bottom: 15px;
  white-space: pre-wrap; 
  word-break: break-word;
}
.description-preview {
  max-height: 120px;
  overflow: hidden;
  margin: 0 0 0.4em 0;
}
.description-full {
  margin: 0;
}
.description-toggle {
  display: inline-block;
  color: #065fd4; /* YouTube青リンク色 */
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  user-select: none;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
  margin-top: 4px;
}

.page-container {
  display: flex;
  gap: 24px;
  padding: 16px;
  flex-wrap: wrap;
}

.main-content {
  flex: 1 1 0;
  min-width: 0;
}

.video-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 8px 0;
  line-height: 1.4;
  color: #030303;
}

.video-meta {
  font-size: 0.9rem;
  color: #000000;
  margin-bottom: 16px;
}

.related-section {
  width: 360px;
  flex-shrink: 0;
}

.related-title {
  font-size: 1.4rem;
  font-weight: 500;
  margin-bottom: 12px;
}

.related-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.related-item {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  cursor: pointer;
}

.thumb-wrapper {
  position: relative;
  width: 168px;
  height: 94.5px;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 4px;
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 4px;
  display: block;
}

/* バッジ（動画時間・ライブ） */
.duration-badge {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  padding: 2px 6px;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 2px;
  pointer-events: none;
  user-select: none;
  z-index: 10;
}
.badge-live {
  background: #e62117;
}
.video-info {
  flex: 1;
}

.video-title-related {
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.3;
  color: #030303;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.video-metadata {
  font-size: 0.8rem;
  color: #606060;
}

.dot {
  margin: 0 4px;
}

.error-msg {
  color: red;
  font-size: 1rem;
  margin-top: 1rem;
}

.loading-msg {
  font-size: 1rem;
  color: #444;
}

.reload-btn {
  padding: 10px 24px;
  background: #444;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1.1em;
  cursor: pointer;
  margin-top: 12px;
  transition: background 0.2s;
}
.reload-btn:hover {
  background: #666;
}

/* 自動再生フィルタ通知 */
.autoplay-notification {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: #333;
  color: #fff;
  padding: 16px 20px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  gap: 16px;
  z-index: 1000;
  animation: slideIn 0.3s ease-out;
  max-width: 400px;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(100px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.notification-text {
  font-size: 0.95rem;
  line-height: 1.4;
}

.notification-close {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  flex-shrink: 0;
}

.notification-close:hover {
  color: #ccc;
}

@media (max-width: 999px) {
  .page-container {
    flex-direction: column;
  }

  .related-section {
    width: 100%;
    margin-top: 32px;
  }

  .related-item {
    gap: 10px;
  }

  .thumb-wrapper {
    width: 140px;
    height: 78.75px; /* 16:9 */
  }

  .video-title {
    font-size: 1.25rem;
  }

  .video-title-related {
    font-size: 0.9rem;
  }

  .video-metadata {
    font-size: 0.8rem;
  }

  .duration-badge {
    font-size: 0.65rem;
    padding: 1px 4px;
  }
}
</style>
