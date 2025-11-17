<template>
  <!-- メインボタン -->
  <button @click="openPopup" class="download-main-btn">
    この動画をダウンロード
  </button>

  <!-- ポップアップ -->
  <div v-if="popupVisible" class="popup-overlay">
    <div class="popup">
      <button class="close-btn" @click="closePopup">×</button>

      <div v-if="loading">読み込み中…</div>

      <div v-else-if="error" class="error">
        {{ error }}
        <button class="retry-btn" @click="fetchStream">再取得</button>
      </div>

      <div v-else>
        <h3>ダウンロード</h3>

        <div class="main-flex-row">
          <div class="main-options">
            <!-- 標準ダウンロード（360p複数対応） -->
            <div class="option" v-if="muxed360pList.length">
              <strong>標準（360p）:</strong>
              <div v-for="item in muxed360pList" :key="item.url">
                <a :href="item.url" target="_blank" rel="noopener" download>ダウンロード</a>
              </div>
            </div>

            <!-- 音声のみ（複数対応） -->
            <div class="option" v-if="audioOnlyList.length">
              <strong>音声のみ:</strong>
              <div v-for="item in audioOnlyList" :key="item.url">
                {{ item.ext }}:
                <a :href="item.url" target="_blank" rel="noopener" download>ダウンロード</a>
              </div>
            </div>

            <!-- 映像のみ（複数対応） -->
            <div class="option" v-if="videoOnlyList.length">
              <strong>映像のみ:</strong>
              <div v-for="item in videoOnlyList" :key="item.url">
                {{ item.resolution }} ({{ item.ext }}):
                <a :href="item.url" target="_blank" rel="noopener" download>ダウンロード</a>
              </div>
            </div>

            <!-- m3u8 proxy -->
            <div class="option" v-if="m3u8ProxyList.length">
              <strong>m3u8（proxy）<span style="font-weight: normal;">*外部サイト(m3u8ダウンロードサイトで検索)との併用でダウンロード可能:</span></strong>
              <div v-for="u in m3u8ProxyList" :key="u.url" class="m3u8-row">
                <div class="meta">
                  {{ u.resolution || "-" }}
                </div>
                <button class="copy-link" @click="copyUrl(u.url)">
                  <span class="url-line">{{ u.url }}</span>
                </button>
                <span class="copied" v-if="lastCopied === u.url">コピーしました</span>
              </div>
            </div>

            <!-- m3u8 raw -->
            <div class="option" v-if="m3u8RawList.length">
              <strong>m3u8　<span style="font-weight: normal;">直接のダウンロードはできません</span>:</strong>
              <div v-for="u in m3u8RawList" :key="u.url" class="m3u8-row">
                <div class="meta">
                  {{ u.resolution || "-" }}
                </div>
                <button class="copy-link" @click="copyUrl(u.url)">
                  <span class="url-line">{{ u.url }}</span>
                </button>
                <span class="copied" v-if="lastCopied === u.url">コピーしました</span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";

const props = defineProps({
  videoId: { type: String, required: true }
});

const popupVisible = ref(false);
const streamData = ref(null);
const error = ref("");
const loading = ref(false);

const muxed360pList = ref([]);
const audioOnlyList = ref([]);
const videoOnlyList = ref([]);
const m3u8RawList = ref([]);
const m3u8ProxyList = ref([]);
const lastCopied = ref("");

function openPopup() {
  popupVisible.value = true;
  if (!streamData.value) {
    fetchStream();
  }
}

function closePopup() {
  popupVisible.value = false;
  streamData.value = null;
  muxed360pList.value = [];
  audioOnlyList.value = [];
  videoOnlyList.value = [];
  m3u8RawList.value = [];
  m3u8ProxyList.value = [];
  error.value = "";
  lastCopied.value = "";
}

async function fetchStream() {
  loading.value = true;
  error.value = "";
  streamData.value = null;

  try {
    const fallbackUrl = `https://script.google.com/macros/s/AKfycbwUuvKAcomprFysE2SFaZrPTHB6Rmhi0ptjQYHzWnoOGyIMA8gMKcOEW_Nz11u695Xv_Q/exec?id=${encodeURIComponent(props.videoId)}`;
    const res = await fetch(fallbackUrl, { credentials: "omit" });
    if (!res.ok || !res.headers.get("content-type")?.includes("application/json")) {
      throw new Error("Not JSON response");
    }
    const data = await res.json();
    streamData.value = data;
  } catch (e) {
    error.value = "ストリームの取得に失敗しました（fetch error）";
    streamData.value = null;
    muxed360pList.value = [];
    audioOnlyList.value = [];
    videoOnlyList.value = [];
    m3u8RawList.value = [];
    m3u8ProxyList.value = [];
  } finally {
    // 共通の後処理（data がセットされていれば下でマップ処理）
    if (streamData.value) {
      const data = streamData.value;
      // muxed 360p
      muxed360pList.value = [];
      if (Array.isArray(data["audio&video"])) {
        muxed360pList.value = data["audio&video"].filter(v => v.resolution === "360p").map(v => ({ url: v.url }));
        if (muxed360pList.value.length === 0) {
          muxed360pList.value = data["audio&video"].map(v => ({ url: v.url }));
        }
      }

      // audio only
      audioOnlyList.value = [];
      if (Array.isArray(data["audio only"])) {
        audioOnlyList.value = data["audio only"].map(v => ({ ext: v.ext, url: v.url }));
      }

      // video only
      videoOnlyList.value = [];
      if (Array.isArray(data["video only"])) {
        videoOnlyList.value = data["video only"].map(v => ({ resolution: v.resolution, ext: v.ext, url: v.url }));
      }

      // m3u8 raw
      m3u8RawList.value = [];
      if (Array.isArray(data["m3u8 raw"])) {
        m3u8RawList.value = data["m3u8 raw"].map(v => ({ url: v.url, resolution: v.resolution }));
      }

      // m3u8 proxy
      m3u8ProxyList.value = [];
      if (Array.isArray(data["m3u8 proxy"])) {
        m3u8ProxyList.value = data["m3u8 proxy"].map(v => ({ url: v.url, resolution: v.resolution }));
      }
    }
    loading.value = false;
  }
}

async function copyUrl(url) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    lastCopied.value = url;
    setTimeout(() => {
      if (lastCopied.value === url) lastCopied.value = "";
    }, 1500);
  } catch (e) {
    // ignore silently
    lastCopied.value = "";
  }
}
</script>

<style scoped>
.main-flex-row {
  display: flex;
  flex-direction: row;
  gap: 32px;
  align-items: flex-start;
}
.main-options {
  flex: 1;
}
.download-main-btn {
  padding: 8px 16px;
  background: #85848485;
  color: #191919;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.popup-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.popup {
  background: white;
  padding: 20px;
  border-radius: 8px;
  width: 420px;
  position: relative;
  max-height: 80vh;
  overflow-y: auto;
}

.close-btn {
  position: absolute;
  right: 10px;
  top: 10px;
  border: none;
  background: none;
  font-size: 18px;
  cursor: pointer;
}

.option {
  margin-top: 12px;
}

.error {
  color: red;
  margin-top: 10px;
}

.retry-btn {
  margin-top: 8px;
  padding: 6px 12px;
  background: #444;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}
.retry-btn:hover {
  background: #666;
}

/* m3u8 表示のスタイル */
.m3u8-row {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.meta {
  font-size: 12px;
  color: #444;
}

/* m3u8のURL */
.copy-link {
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  text-align: left;
  cursor: pointer;
  width: 100%;
}
.url-line {
  display: block;
  white-space: nowrap;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  max-width: 100%;
  font-family: monospace;
  font-size: 12px;
  color: #0066cc;
  text-decoration: underline;
  background: #f6f6f6;
  padding: 6px;
  border-radius: 4px;
}

/* コピー済み表示 */
.copied {
  font-size: 12px;
  color: #2a8a2a;
  margin-top: 4px;
}
</style>
