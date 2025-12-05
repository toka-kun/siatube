<template>
    <HeaderSearch 
      @search="onSearch" 
      @toggle-dark-mode="toggleDarkMode"
      @toggle-sidebar="handleToggleSidebar"
      :sidebar-open="sidebarOpen"
    />
    <Sidebar :open="sidebarOpen" :is-watch-page="route.path === '/watch'" />
    <main class="app-content" :class="{ 'sidebar-closed': !sidebarOpen }">
      <router-view />
    </main>
    <SettingsView />
</template>

<script>
import HeaderSearch from '@/components/HeaderSearch.vue';
import Sidebar from '@/components/Sidebar.vue';
import SettingsView from '@/views/SettingsView.vue';
import { ref, computed, provide, watch, onBeforeUnmount } from 'vue';
import { loadDisplayMode, computeIsDarkFromMode } from '@/utils/settingsManager';
import { useRoute } from 'vue-router';

export default {
  name: 'App',
  components: {
    HeaderSearch,
    Sidebar,
    SettingsView
  },
  setup() {
    console.log('[App.vue] setup() called');
    const route = useRoute();
    const viewportWidth = ref(window.innerWidth);
    // Initialize sidebarOpen based on screen width (consistent default)
    const sidebarOpen = ref(window.innerWidth >= 1315);
    const settingsModalOpen = ref(false);

    // Always initialize settingsModalOpen to false on page load
    console.log('[App.vue] Initialized settingsModalOpen to false on page load');

    const toggleSidebar = () => {
      sidebarOpen.value = !sidebarOpen.value;
    };

    const handleToggleSidebar = (isOpen) => {
      sidebarOpen.value = isOpen;
    };

    const openSettingsModal = () => {
      console.log('[App.vue] openSettingsModal called');
      settingsModalOpen.value = true;
    };

    const closeSettingsModal = () => {
      console.log('[App.vue] closeSettingsModal called');
      settingsModalOpen.value = false;
    };

    // Persist modal state to localStorage whenever it changes
    watch(settingsModalOpen, (newVal) => {
      console.log('[App.vue] settingsModalOpen changed to:', newVal);
      try {
        localStorage.setItem('settingsModalOpen', newVal ? 'true' : 'false');
      } catch (e) {
        console.warn('[App.vue] Failed to write settingsModalOpen to localStorage', e);
      }
      // Update body class for styling (e.g., sidebar max-height when settings is open)
      try {
        document.body.classList.toggle('settings-modal-open', newVal);
      } catch (e) {}
    });

    // Sync local state across tabs/windows
    const handleStorage = (e) => {
      if (!e || !e.key) return;
      if (e.key === 'settingsModalOpen') {
        const newVal = e.newValue === 'true';
        console.log('[App.vue] storage event for settingsModalOpen, newValue=', e.newValue);
        settingsModalOpen.value = newVal;
      }
    };
    window.addEventListener('storage', handleStorage);
    onBeforeUnmount(() => window.removeEventListener('storage', handleStorage));

    // Update sidebarOpen when viewport resizes across thresholds
    const updateSidebarByWidth = () => {
      const w = window.innerWidth;
      if (w >= 1315) sidebarOpen.value = true;
      else if (w >= 790) sidebarOpen.value = false; // compact
      else sidebarOpen.value = false; // hidden
      viewportWidth.value = w;
    };
    window.addEventListener('resize', updateSidebarByWidth);

    // Monitor route changes and hide sidebar for /watch page
    watch(() => route.path, (newPath) => {
      if (newPath === '/watch') {
        sidebarOpen.value = false;
      } else {
        updateSidebarByWidth();
      }
    });

    // Provide settings modal functions
    console.log('[App.vue] Providing settingsModal with isOpen:', settingsModalOpen);
    provide('settingsModal', {
      isOpen: settingsModalOpen,
      openSettingsModal,
      closeSettingsModal,
    });

    return {
      route,
      sidebarOpen,
      toggleSidebar,
      handleToggleSidebar,
      viewportWidth,
      settingsModalOpen,
    };
  },
  methods: {
    onSearch(keyword) {
      if (!keyword || !keyword.trim()) return;
      this.$router?.push({ path: '/search', query: { q: keyword.trim() } });
    },
    toggleDarkMode(isDarkMode) {
      // This method is for legacy compatibility; new code should use SettingsView
      if (isDarkMode) {
        document.documentElement.classList.add('dark-mode');
      } else {
        document.documentElement.classList.remove('dark-mode');
      }
      // update legacy key only for backward compatibility
      try { localStorage.setItem('darkMode', isDarkMode ? 'true' : 'false'); } catch(e) {}
    }
  },
  mounted() {
    // ページ読み込み時に表示モードを読み込んでダークモードを適用
    try {
      const mode = loadDisplayMode();
      const isDarkMode = computeIsDarkFromMode(mode);
      console.log(`[App.vue] mounted: displayMode=${mode} -> isDarkMode=${isDarkMode}`);
      if (isDarkMode) {
        document.documentElement.classList.add('dark-mode');
      } else {
        document.documentElement.classList.remove('dark-mode');
      }
    } catch (e) {
      console.warn('[App.vue] Error loading displayMode on mount', e);
      // Fallback: do not apply dark mode if loading fails
    }

    // ウィンドウリサイズは setup() 側で管理しています
  }
};
</script>

<style>
#app {
  padding-top: 52px;
  box-sizing: border-box;
}

.app-content {
  margin-left: 250px;
  transition: margin-left 0.3s ease;
}

@media (min-width: 1315px) {
  .app-content {
    margin-left: 250px;
  }

  .app-content.sidebar-closed {
    margin-left: 70px;
  }
}

@media (min-width: 790px) and (max-width: 1314px) {
  .app-content {
    margin-left: 70px;
  }
}

@media (max-width: 789px) {
  .app-content {
    margin-left: 0;
  }
}
</style>
