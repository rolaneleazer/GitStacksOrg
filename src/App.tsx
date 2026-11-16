import { useCallback, useEffect, useState } from 'react';
import {
  AdSenseScriptLoader,
  CookieConsentBanner,
  GoogleAnalyticsLoader,
  useCookieConsent
} from './components/AdSenseCompliance.tsx';
import { FloatingLiveChat } from './components/FloatingLiveChat.tsx';
import { BuyMeACoffeeWidget } from './components/BuyMeACoffee.tsx';
import { Footer, Header } from './components/LayoutChrome.tsx';
import { api, getExistingFloatingChatToken } from './lib/api.ts';
import { ArticlePage } from './pages/ArticlePage.tsx';
import { DemoPage } from './pages/DemoPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { InsightsPage } from './pages/InsightsPage.tsx';
import {
  AboutPage,
  ContactPage,
  CookiePolicyPage,
  DisclaimerPage,
  EditorialPolicyPage,
  PrivacyPolicyPage,
  TermsPage
} from './pages/LegalAndTrustPages.tsx';
import { ServicesPage } from './pages/ServicesPage.tsx';
import { StudioPage } from './pages/StudioPage.tsx';
import { SEED_ARTICLES } from './shared/seedData.ts';
import { applyThemeToDocument } from './shared/themePresets.ts';
import type { AdSenseSettings, Article, PageContentConfig } from './shared/types.ts';

function getCurrentRoute(): string {
  return window.location.pathname || '/';
}

export default function App() {
  const [route, setRoute] = useState<string>(getCurrentRoute);
  const [articles, setArticles] = useState<Article[]>(SEED_ARTICLES);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [adSenseSettings, setAdSenseSettings] = useState<AdSenseSettings | null>(null);
  const [pageContents, setPageContents] = useState<PageContentConfig[]>([]);
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  useEffect(() => {
    const onQuota = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  // Real-time Product QA Telemetry: capture uncaught client runtime errors & unhandled rejections
  useEffect(() => {
    const onWindowError = (event: ErrorEvent) => {
      const msg = event.message || 'Uncaught window error';
      if (msg.includes('ResizeObserver') || msg.includes('WebSocket')) return;
      const loc = event.filename
        ? `${event.filename.replace(window.location.origin, '')}:${event.lineno || 0}:${event.colno || 0}`
        : '';
      api.reportClientQaError({
        level: 'error',
        source: 'frontend',
        page_path: window.location.pathname || '/',
        code_location: loc,
        error_name: event.error?.name || 'RuntimeError',
        message: msg,
        stack_trace: event.error?.stack || ''
      });
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const msg =
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
            ? reason
            : 'Unhandled Promise Rejection';
      if (!msg || msg.includes('WebSocket') || msg.includes('DEMO_EXPIRED')) return;
      api.reportClientQaError({
        level: 'error',
        source: 'frontend',
        page_path: window.location.pathname || '/',
        error_name: reason instanceof Error ? reason.name || 'UnhandledRejection' : 'UnhandledRejection',
        message: msg,
        stack_trace: reason instanceof Error ? reason.stack || '' : ''
      });
    };

    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  const {
    consent,
    modalOpen,
    openPreferences,
    closePreferences,
    acceptAll,
    acceptEssentialOnly
  } = useCookieConsent();

  const refreshPublicData = useCallback(async () => {
    try {
      const [postsRes, settingsRes, pagesRes] = await Promise.all([
        api.listPosts(false),
        api.getAdSenseSettings(),
        api.listPageContents().catch(() => ({ pages: [] as PageContentConfig[] }))
      ]);
      setArticles(postsRes.posts);
      setAdSenseSettings(settingsRes.settings);
      if (pagesRes.pages.length > 0) {
        setPageContents(pagesRes.pages);
      }
    } catch {
      // keep initial seed articles if network fails transiently
    } finally {
      setLoadingArticles(false);
    }
  }, []);

  useEffect(() => {
    refreshPublicData();
  }, [refreshPublicData]);

  useEffect(() => {
    applyThemeToDocument(adSenseSettings);
  }, [adSenseSettings]);

  useEffect(() => {
    const isAdminRoute = route.startsWith('/obama') || route.startsWith('/studio');
    if (isAdminRoute) return;
    api.trackAnalyticsEvent('pageview', route || '/');
    api.sendPublicPresence(route || '/');
    const id = window.setInterval(() => {
      api.sendPublicPresence(route || '/');
    }, 60_000);
    return () => window.clearInterval(id);
  }, [route]);

  useEffect(() => {
    const onPopState = () => {
      setRoute(getCurrentRoute());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((target: string) => {
    const [pathPart, hashPart] = target.split('#');
    const cleanPath = pathPart || '/';
    const fullTarget = hashPart ? `${cleanPath}#${hashPart}` : cleanPath;

    if (window.location.pathname + window.location.hash !== fullTarget) {
      window.history.pushState({}, '', fullTarget);
    }
    setRoute(cleanPath);

    if (hashPart) {
      setTimeout(() => {
        const el = document.getElementById(hashPart);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const getPageConfig = (key: PageContentConfig['page_key']) =>
    pageContents.find((p) => p.page_key === key);

  const renderPage = () => {
    if (route === '/' || route === '') {
      return (
        <HomePage
          articles={articles}
          pageContent={getPageConfig('home')}
          onNavigate={navigate}
        />
      );
    }
    if (route === '/services') {
      return (
        <ServicesPage
          pageContent={getPageConfig('services')}
          onNavigate={navigate}
        />
      );
    }
    if (route === '/demo') {
      return <DemoPage onNavigate={navigate} />;
    }
    if (route === '/insights') {
      return (
        <InsightsPage
          articles={articles}
          loading={loadingArticles}
          onNavigate={navigate}
        />
      );
    }
    if (route.startsWith('/insights/')) {
      const slug = route.replace('/insights/', '').replace(/\/$/, '');
      return (
        <ArticlePage
          slug={slug}
          articles={articles}
          adSenseSettings={adSenseSettings}
          consent={consent}
          onOpenCookiePrefs={openPreferences}
          onNavigate={navigate}
        />
      );
    }
    if (route === '/about') {
      return (
        <AboutPage
          pageContent={getPageConfig('about')}
          onNavigate={navigate}
        />
      );
    }
    if (route === '/contact') {
      return (
        <ContactPage
          pageContent={getPageConfig('contact')}
          onNavigate={navigate}
        />
      );
    }
    if (route === '/editorial-policy') {
      return <EditorialPolicyPage />;
    }
    if (route === '/privacy-policy') {
      return <PrivacyPolicyPage />;
    }
    if (route === '/terms') {
      return <TermsPage />;
    }
    if (route === '/cookie-policy') {
      return <CookiePolicyPage onOpenCookiePrefs={openPreferences} />;
    }
    if (route === '/disclaimer') {
      return <DisclaimerPage />;
    }
    if (route === '/obama' || route === '/studio') {
      return (
        <StudioPage
          onArticlesChanged={refreshPublicData}
          onPagesChanged={refreshPublicData}
          onSettingsChanged={(next) => setAdSenseSettings(next)}
          onNavigate={navigate}
        />
      );
    }
    return (
      <HomePage
        articles={articles}
        pageContent={getPageConfig('home')}
        onNavigate={navigate}
      />
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--gs-canvas-bg)] text-slate-900">
      {gmpQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}
      <AdSenseScriptLoader settings={adSenseSettings} consent={consent} />
      <GoogleAnalyticsLoader settings={adSenseSettings} consent={consent} route={route} />
      <Header currentPath={route} settings={adSenseSettings} onNavigate={navigate} />
      <main className="flex-1">{renderPage()}</main>
      <Footer settings={adSenseSettings} onNavigate={navigate} onOpenCookiePrefs={openPreferences} />
      <CookieConsentBanner
        consent={consent}
        modalOpen={modalOpen}
        onAcceptAll={acceptAll}
        onAcceptEssential={acceptEssentialOnly}
        onCloseModal={closePreferences}
        onNavigate={navigate}
      />
      {!route.startsWith('/obama') &&
        !route.startsWith('/studio') && (
          <>
            <BuyMeACoffeeWidget settings={adSenseSettings} yOffset={84} position="Right" />
            {(route === '/' || route === '' || Boolean(getExistingFloatingChatToken())) && (
              <FloatingLiveChat currentRoute={route || '/'} />
            )}
          </>
        )}
    </div>
  );
}
