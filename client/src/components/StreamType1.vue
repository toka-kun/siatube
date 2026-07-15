<template>
  <div v-if="error" class="error-box">
    ⚠️ {{ error }}
    <button type="button" class="reload-button" @click="loadStream(true)">再取得</button>
  </div>
  <div v-else-if="stream" class="video-container">
    <video
      ref="videoRef"
      :key="`${videoId}:${stream.url}`"
      controls
      playsinline
      preload="metadata"
      @ended="handleEnded"
      @error="handlePlaybackError"
    >
      <source v-if="!useHlsJs" :src="stream.url" :type="stream.mimeType" />
      <track
        v-for="track in subtitleTracks"
        :key="`${track.srclang}:${track.src}`"
        :src="track.src"
        :srclang="track.srclang"
        :label="track.label"
        :kind="track.kind"
        :default="track.default"
      />
    </video>
  </div>
  <div v-else-if="loading" class="loading">読み込み中...</div>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { stream as fetchStream } from "@/services/siatubeApi";
import { loadHlsConstructor } from "@/utils/hlsLoader";
import {
  localizeSubtitleTracks,
  revokeSubtitleTracks,
  selectPlaybackSubtitleTracks,
} from "@/utils/subtitleTracks";
import {
  extractSubtitleTracks,
  primaryPlayableStream,
} from "@/utils/siatubeAdapters";

const props = defineProps({
  videoId: { type: String, required: true },
});

const emit = defineEmits([
  "ended",
  "play-autoplay-candidate",
  "autoplay-no-suitable-video",
]);

const stream = ref(null);
const subtitleTracks = ref([]);
const videoRef = ref(null);
const useHlsJs = ref(false);
const error = ref("");
const loading = ref(false);
let requestSequence = 0;
let hlsInstance = null;
let HlsConstructor = null;

function destroyHls() {
  if (!hlsInstance) return;
  try { hlsInstance.destroy(); } catch (e) {}
  hlsInstance = null;
}

function supportsNativeHls() {
  const video = document.createElement("video");
  return Boolean(
    video.canPlayType("application/vnd.apple.mpegurl") ||
    video.canPlayType("application/x-mpegURL")
  );
}

async function loadStream(forceRefresh = false) {
  const id = props.videoId;
  if (!id) return;
  const sequence = ++requestSequence;
  destroyHls();
  stream.value = null;
  revokeSubtitleTracks(subtitleTracks.value);
  subtitleTracks.value = [];
  useHlsJs.value = false;
  error.value = "";
  loading.value = true;

  try {
    const data = await fetchStream(id, {
      forceRefresh: forceRefresh === true,
      retries: 1,
      timeout: 30000,
    });
    if (sequence !== requestSequence) return;
    const locale = typeof navigator !== "undefined" ? navigator.language : "ja";
    stream.value = primaryPlayableStream(data, locale);
    const rawSubtitleTracks = selectPlaybackSubtitleTracks(
      extractSubtitleTracks(data, locale)
    );
    if (!stream.value) error.value = "利用可能なストリームがありません。";
    if (stream.value?.isM3u8 && !supportsNativeHls()) {
      HlsConstructor = await loadHlsConstructor();
      if (sequence !== requestSequence || id !== props.videoId) return;
    }
    useHlsJs.value = Boolean(
      stream.value?.isM3u8 && !supportsNativeHls() && HlsConstructor?.isSupported()
    );
    if (useHlsJs.value) {
      await nextTick();
      if (sequence !== requestSequence || id !== props.videoId || !videoRef.value) return;
      hlsInstance = new HlsConstructor();
      hlsInstance.loadSource(stream.value.url);
      hlsInstance.attachMedia(videoRef.value);
      hlsInstance.on(HlsConstructor.Events.ERROR, (_event, data) => {
        if (data?.fatal && sequence === requestSequence) {
          error.value = "HLSストリームを再生できませんでした。";
          destroyHls();
        }
      });
    }
    const localizedTracks = await localizeSubtitleTracks(rawSubtitleTracks);
    if (sequence !== requestSequence || id !== props.videoId) {
      revokeSubtitleTracks(localizedTracks);
      return;
    }
    subtitleTracks.value = localizedTracks;
  } catch (cause) {
    if (sequence !== requestSequence) return;
    error.value = cause?.name === "AbortError"
      ? "ストリームURLの取得がタイムアウトしました。"
      : "ストリームURLの取得に失敗しました。";
  } finally {
    if (sequence === requestSequence) loading.value = false;
  }
}

function handlePlaybackError() {
  if (!loading.value) error.value = "このストリームを再生できませんでした。";
}

function durationSeconds(value) {
  if (!value) return null;
  const parts = String(value).split(":").map(Number);
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function handleEnded() {
  emit("ended");
  const filter = window.__autoplayDurationFilter || { enabled: false };
  if (!filter.enabled) return;

  let foundCandidate = false;
  for (const element of document.querySelectorAll("[data-video-id]")) {
    const id = element.getAttribute("data-video-id");
    if (!id || id === props.videoId) continue;
    foundCandidate = true;
    const seconds = durationSeconds(element.getAttribute("data-duration"));
    if (seconds !== null && seconds > Number(filter.maxSeconds || Infinity)) continue;
    emit("play-autoplay-candidate", { id });
    return;
  }
  if (foundCandidate) emit("autoplay-no-suitable-video");
}

onBeforeUnmount(() => {
  requestSequence += 1;
  destroyHls();
  revokeSubtitleTracks(subtitleTracks.value);
});

watch(
  () => props.videoId,
  () => loadStream(),
  { immediate: true }
);
</script>

<style scoped>
.video-container {
  position: relative;
  aspect-ratio: 16 / 9;
  background: #000;
  overflow: hidden;
}

.video-container video {
  width: 100%;
  height: 100%;
  display: block;
  background: #000;
}

.loading {
  height: 50px;
  color: var(--text-primary);
}

.error-box {
  color: var(--accent-weak);
  margin: 10px;
}

.reload-button {
  margin-top: 6px;
  padding: 6px 12px;
  font-size: 9px;
  background: var(--text-secondary);
  color: var(--on-accent);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  width: 50%;
}

.reload-button:hover {
  background: var(--text-secondary-hover);
}
</style>
