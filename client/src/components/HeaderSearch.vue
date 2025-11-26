<template>
  <div class="header-wrapper fixed-header">
    <button
      type="button"
      class="home-button"
      @click="$router.push('/')"
      aria-label="トップページへ戻る"
    >ホーム
    </button>

    <form @submit.prevent="onSubmit" class="header-search" ref="searchFormRef">
      <input
        type="text"
        v-model="query"
        @input="onInput"
        @keydown.down.prevent="moveSelection(1)"
        @keydown.up.prevent="moveSelection(-1)"
        @keydown.enter.prevent="onEnter"
        placeholder="キーワードを入力..."
        autocomplete="off"
        class="search-input"
        aria-label="Search"
      />
      <!-- 🔍検索ボタンの前に追加 -->
<button
  v-if="query"
  type="button"
  class="clear-button"
  @click="clearQuery"
  aria-label="入力をクリア"
>
  ×
</button>

      <button type="submit" class="search-button" aria-label="検索">
        <img
          :src="searchiconIcon"
          alt="🔍"
          style="width: 20px; height: 20px"
        />
      </button>

      <ul v-if="suggestions.length" class="suggestions-list" role="listbox">
        <li
          v-for="(item, index) in suggestions"
          :key="index"
          :class="{ selected: index === selectedIndex }"
          @mousedown.prevent="onSuggestionClick(index)"
          role="option"
          :aria-selected="index === selectedIndex"
        >
          {{ item }}
        </li>
      </ul>
    </form>

    <!-- 右側に設定ボタンとモーダル -->
    <div class="header-settings">
      <button class="settings-button" type="button" @click="toggleSettings" aria-label="設定を開く">
        <img :src="settingIcon" alt="設定アイコン" style="width: 30px; height: 30px;" />
      </button>

      <div v-if="settingsOpen" class="settings-modal" role="dialog" aria-modal="true">
        <h3>API エンドポイント設定</h3>

        <div class="mode-group">
          <label><input type="radio" v-model="mode" value="existing" /> 既存 API のみを使用</label>
          <label><input type="radio" v-model="mode" value="custom" /> カスタムのみを使用</label>
          <label><input type="radio" v-model="mode" value="both" /> 両方をランダムに使用</label>
        </div>

        <!-- デフォルト再生方式の追加 -->
        <div class="playback-default">
          <h4>デフォルト再生方式</h4>
          <label><input type="radio" v-model="defaultPlaybackMode" value="1" /> 通常</label>
          <label><input type="radio" v-model="defaultPlaybackMode" value="2" /> タイプ２</label>
        </div>

        <!-- 短動画フィルタ設定 -->
        <div class="short-video-filter">
          <h4 style="margin-block-end: 10px;">自動再生フィルタ</h4>
          <label>
            <input type="checkbox" v-model="shortVideoFilterEnabled" />
            指定時間以下の動画のみ自動再生
          </label>
          <div v-if="shortVideoFilterEnabled" class="filter-time">
            <label>
              制限時間（分）:
              <input type="number" v-model.number="shortVideoFilterMinutes" min="1" max="120" step="1" />
            </label><br>
            <small>{{ shortVideoFilterMinutes }}分以下の動画のみが自動再生対象になります</small>
          </div>
        </div>

        <div class="custom-list">
          <h4>カスタムエンドポイント</h4>
          <ul>
            <li v-for="(url, i) in customEndpoints" :key="i">
              <span class="endpoint-text">{{ url }}</span>
              <button type="button" class="remove-btn" @click="removeEndpoint(i)" aria-label="削除">削除</button>
            </li>
            <li v-if="customEndpoints.length === 0">
              <CustomEndpointsHelp />
            </li>
          </ul>

          <div class="add-row">
            <input type="text" v-model="newEndpoint" placeholder="https://siawaseok.duckdns.org/exec" />
            <button type="button" @click="addEndpoint">追加</button>
          </div>
        </div>

        <div class="settings-actions">
          <button type="button" @click="closeSettings">閉じる</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import settingIcon from '/Image/setting.txt?raw'
import searchiconIcon from '/Image/searchicon.txt?raw'
import CustomEndpointsHelp from "./CustomEndpointsHelp.vue";

import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import { useRouter } from "vue-router";
import { apiurl, STORAGE_KEY, MODE_KEY } from "../api.js";
import {
  getEffectiveApiUrl,
  loadCustomEndpoints as rmLoadCustomEndpoints,
  saveCustomEndpoints as rmSaveCustomEndpoints,
  loadMode as rmLoadMode,
  saveMode as rmSaveMode,
} from "@/services/requestManager";

const router = useRouter();
// 変更: 詳細イベントを追加で定義
const emit = defineEmits(["search", "searchMeta"]);

const query = ref("");
const suggestions = ref([]);
const selectedIndex = ref(-1);
let fetchController = null;

const searchFormRef = ref(null);

const onClickOutside = (event) => {
  if (searchFormRef.value && !searchFormRef.value.contains(event.target)) {
    suggestions.value = [];
    selectedIndex.value = -1;
  }
};

onMounted(() => {
  document.addEventListener("click", onClickOutside);
  router.push('/');
  // load custom endpoints from requestManager (centralized)
  try {
    customEndpoints.value = rmLoadCustomEndpoints() || [];
  } catch (e) {
    customEndpoints.value = [];
  }
  // load saved mode
  try {
    const m = rmLoadMode();
    if (m) mode.value = m;
  } catch (e) {}
  // load default playback mode from localStorage / cookie (localStorage を優先)
  try {
    // localStorage を優先的に読む（沙箱環境での Cookie 制限に対応）
    const fromStorage = localStorage.getItem("defaultPlaybackMode");
    if (fromStorage) {
      defaultPlaybackMode.value = fromStorage;
      // Cookie にも同期させる
      saveDefaultPlayback();
    } else {
      // localStorage にない場合は Cookie から取得
      const m = (document.cookie.match(new RegExp("(^| )StreamType=([^;]+)")) || [])[2];
      if (m) {
        defaultPlaybackMode.value = decodeURIComponent(m);
        // localStorage にも同期させる
        saveDefaultPlayback();
      } else {
        defaultPlaybackMode.value = "1";
        // 初期値をデフォルトとして保存
        saveDefaultPlayback();
      }
    }
  } catch (e) {
    defaultPlaybackMode.value = localStorage.getItem("defaultPlaybackMode") || "1";
  }
  // load short video filter settings
  loadShortVideoFilter();
});

onBeforeUnmount(() => {
  document.removeEventListener("click", onClickOutside);
});

const fetchSuggestions = async (keyword) => {
  if (!keyword) {
    suggestions.value = [];
    selectedIndex.value = -1;
    return;
  }
  if (fetchController) fetchController.abort();
  fetchController = new AbortController();

  try {
    const res = await fetch(
      `https://www.google.com/complete/search?client=youtube&hl=ja&ds=yt&q=${encodeURIComponent(keyword)}`,
      { signal: fetchController.signal }
    );
    if (!res.ok) throw new Error("Network error");
    const data = await res.json();
    suggestions.value = data;
    selectedIndex.value = -1;
  } catch (e) {
    if (e.name !== "AbortError") {
      suggestions.value = [];
      selectedIndex.value = -1;
      console.error(e);
    }
  }
};

const onInput = () => {
  fetchSuggestions(query.value.trim());
};

const moveSelection = (delta) => {
  if (suggestions.value.length === 0) return;
  selectedIndex.value += delta;
  if (selectedIndex.value < 0) selectedIndex.value = suggestions.value.length - 1;
  if (selectedIndex.value >= suggestions.value.length) selectedIndex.value = 0;
  query.value = suggestions.value[selectedIndex.value];
};

const onEnter = () => {
  if (selectedIndex.value >= 0) {
    query.value = suggestions.value[selectedIndex.value];
  }
  submitSearch();
};

const onSuggestionClick = (index) => {
  query.value = suggestions.value[index];
  submitSearch();
};

// --- ここから設定・カスタムエンドポイント管理 ---
const settingsOpen = ref(false);
const customEndpoints = ref([]);
const newEndpoint = ref("");
const mode = ref("existing"); // existing | custom | both

// デフォルト再生方式: '1' = 通常, '2' = タイプ2
const defaultPlaybackMode = ref("1");

// 短動画フィルタ設定
const shortVideoFilterEnabled = ref(false);
const shortVideoFilterMinutes = ref(4); // デフォルト 4 分

function saveDefaultPlayback() {
  try {
    // cookie に保存（VideoPlayer が参照するため）
    const seconds = 60 * 60 * 24 * 365 * 10; // 10年
    const expires = new Date(Date.now() + seconds * 1000).toUTCString();
    document.cookie = `StreamType=${encodeURIComponent(
      defaultPlaybackMode.value
    )}; expires=${expires}; path=/`;
    // ローカルにも保存して UI の初期化に使う
    localStorage.setItem("defaultPlaybackMode", defaultPlaybackMode.value);
  } catch (e) {
    console.error("saveDefaultPlayback error", e);
  }
}

function saveShortVideoFilter() {
  try {
    localStorage.setItem("shortVideoFilterEnabled", JSON.stringify(shortVideoFilterEnabled.value));
    localStorage.setItem("shortVideoFilterMinutes", JSON.stringify(shortVideoFilterMinutes.value));
    // グローバルオブジェクトにも設定して StreamType2 が読める様にする
    window.__autoplayDurationFilter = {
      enabled: shortVideoFilterEnabled.value,
      minutes: shortVideoFilterMinutes.value,
      maxSeconds: shortVideoFilterMinutes.value * 60
    };
    console.log("[HeaderSearch] saveShortVideoFilter:", window.__autoplayDurationFilter);
  } catch (e) {
    console.error("saveShortVideoFilter error", e);
  }
}

function loadShortVideoFilter() {
  try {
    const enabled = localStorage.getItem("shortVideoFilterEnabled");
    const minutes = localStorage.getItem("shortVideoFilterMinutes");
    if (enabled !== null) shortVideoFilterEnabled.value = JSON.parse(enabled);
    if (minutes !== null) shortVideoFilterMinutes.value = JSON.parse(minutes);
    // グローバルオブジェクトを初期化
    window.__autoplayDurationFilter = {
      enabled: shortVideoFilterEnabled.value,
      minutes: shortVideoFilterMinutes.value,
      maxSeconds: shortVideoFilterMinutes.value * 60
    };
    console.log("[HeaderSearch] loadShortVideoFilter:", window.__autoplayDurationFilter);
  } catch (e) {
    console.error("loadShortVideoFilter error", e);
  }
}

// defaultPlaybackMode が変わったら保存
watch(defaultPlaybackMode, () => {
  saveDefaultPlayback();
});

// shortVideoFilterEnabled が変わったら保存
watch(shortVideoFilterEnabled, () => {
  saveShortVideoFilter();
});

// shortVideoFilterMinutes が変わったら保存
watch(shortVideoFilterMinutes, () => {
  saveShortVideoFilter();
});

const STORAGE_KEY_LOCAL = STORAGE_KEY; // from api.js (kept for compatibility)

function loadCustomEndpoints() {
  // load via requestManager wrapper (keeps single source of truth)
  try {
    customEndpoints.value = rmLoadCustomEndpoints() || [];
  } catch {
    customEndpoints.value = [];
  }
}

function saveCustomEndpoints() {
  try {
    rmSaveCustomEndpoints(customEndpoints.value || []);
  } catch (e) {
    console.error("saveCustomEndpoints error", e);
  }
}

function isValidUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function addEndpoint() {
  const v = newEndpoint.value.trim();
  if (!v) return;
  if (!isValidUrl(v)) {
    alert("有効なURLを入力してください。");
    return;
  }
  if (customEndpoints.value.includes(v)) {
    alert("既に追加されています。");
    newEndpoint.value = "";
    return;
  }
  customEndpoints.value.push(v);
  newEndpoint.value = "";
  saveCustomEndpoints();
}

function removeEndpoint(index) {
  customEndpoints.value.splice(index, 1);
  saveCustomEndpoints();
}

function toggleSettings() {
  settingsOpen.value = !settingsOpen.value;
}

function closeSettings() {
  settingsOpen.value = false;
}

const chooseApiUrl = () => {
  // 中央管理された選択ロジックを使う（requestManager の getEffectiveApiUrl を優先）
  try {
    const u = getEffectiveApiUrl();
    if (typeof u === "string" && u) return u;
  } catch (e) {
    // ignore and fallback to local selection
  }
  // fallback: local selection mirroring previous behavior
  const customs = customEndpoints.value || [];
  if (mode.value === "existing") return apiurl();
  if (mode.value === "custom") return customs.length ? customs[Math.floor(Math.random() * customs.length)] : apiurl();
  const pool = [...customs];
  pool.push(apiurl());
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : apiurl();
};

const submitSearch = () => {
  const trimmed = query.value.trim();
  if (!trimmed) return;
  suggestions.value = [];
  selectedIndex.value = -1;
  const chosen = chooseApiUrl();
  // 互換性維持: 既存ハンドラ向けに文字列のみを emit
  emit("search", trimmed);
  // 拡張情報が必要なコンポーネント向けに別イベントを emit
  emit("searchMeta", { query: trimmed, apiUrl: chosen, mode: mode.value });
};

const onSubmit = () => {
  submitSearch();
};

const clearQuery = () => {
  query.value = "";
  suggestions.value = [];
  selectedIndex.value = -1;
};

// mode を変更したら localStorage に保存（他コンポーネントと同期するため）
watch(mode, (v) => {
  try {
    rmSaveMode(v);
  } catch (e) {}
});
</script>

<style scoped>
.clear-button {
  position: absolute;
  right: 1.9em;
  bottom: -1px; 
  background: transparent;
  border: none;
  font-size: 1.5em;
  cursor: pointer;
  color: #555;
  padding: 0 0.5em;
  height: calc(100% - 1px);
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  user-select: none;
  transition: color 0.2s ease;
}

.clear-button:hover {
  color: #000; 
}

.header-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 100vw;
  padding: 0.5rem 1rem;
  box-sizing: border-box;
  background-color: white;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  height: 54px; 
  position: fixed; 
  top: 0;
  left: 0;
}

.home-button {
  border: none;
  background:rgb(184, 184, 184);
  color:rgb(78, 77, 77);
  font-size: 16px;
  border-radius: 10%;
  width: auto;
  height: 36px;
  cursor: pointer;
  user-select: none;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.5s ease;
  flex-shrink: 0;
}

.home-button:hover {
  background:rgb(136, 136, 136);
}

.header-search {
  display: flex;
  align-items: center;
  flex: 1;
  max-width: 600px;
  margin: 0 auto;
  position: relative;
  height: 40px; 
}

.search-input {
  flex: 1;
  height: 100%;
  padding: 5px 12px 7px 12px; 
  line-height: 28px;
  border-radius: 20px 0 0 20px;
  border: 1px solid #ccc;
  outline: none;
  font-size: 0.9rem;
  box-sizing: border-box;
  text-align: left;
  vertical-align: middle;
}

.search-button {
  border-radius: 0 20px 20px 0;
  border: 1px solid #ccc;
  border-left: none;
  background-color: #f8f8f8;
  cursor: pointer;
  padding: 0 0.75em;
  font-size: 1.1rem;
  user-select: none;
  height: 100%;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.suggestions-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ccc;
  border-top: none;
  max-height: 250px;
  overflow-y: auto;
  z-index: 10;
  border-radius: 0 0 10px 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.suggestions-list li {
  padding: 0.5em 1em;
  cursor: pointer;
}

.suggestions-list li.selected,
.suggestions-list li:hover {
  background-color: #f0f0f0;
}

/* 設定UI用スタイル */
.header-settings {
  position: relative;
  margin-left: 0.5rem;
  flex-shrink: 0;
}

.settings-button {
  border: none;
  background: transparent;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 6px;
}

.settings-modal {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  width: 320px;
  background: #fff;
  border: 1px solid #ddd;
  box-shadow: 0 6px 20px rgba(0,0,0,0.12);
  padding: 12px;
  z-index: 2000;
  border-radius: 8px;
}

.settings-modal h3 {
  margin: 0 0 8px 0;
  font-size: 1rem;
}

.mode-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.9rem;
}

.custom-list h4 {
  margin: 8px 0 6px 0;
  font-size: 0.95rem;
}

.custom-list ul {
  max-height: 120px;
  overflow-y: auto;
  padding: 0;
  margin: 0 0 8px 0;
  list-style: none;
}

.custom-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 0.85rem;
}

.endpoint-text {
  word-break: break-all;
  margin-right: 8px;
  font-size: 0.85rem;
  color: #333;
}

.remove-btn {
  background: #f66;
  border: none;
  color: #fff;
  padding: 4px 6px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
}

.add-row {
  display: flex;
  gap: 6px;
}

.add-row input[type="text"] {
  flex: 1;
  padding: 6px;
  font-size: 0.9rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.add-row button {
  padding: 6px 8px;
  cursor: pointer;
}

.settings-actions {
  text-align: right;
  margin-top: 8px;
}

.settings-actions button {
  padding: 6px 8px;
}

.playback-default {
  margin: 10px 0;
}

.playback-default h4 {
  margin: 6px 0;
  font-size: 0.95rem;
}
</style>
