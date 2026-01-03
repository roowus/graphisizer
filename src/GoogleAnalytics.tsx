// Google Analytics tracking helper functions
// Note: gtag.js is loaded in index.html

/**
 * Google Analytics Provider Component
 * Placeholder component - gtag.js is loaded in index.html
 */
export function GoogleAnalytics() {
  return null;
}

/**
 * Track page views
 */
export const trackPageView = (page_title: string, page_location: string, page_path: string) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'page_view', {
      page_title,
      page_location,
      page_path,
    });
    console.log('Page view tracked:', page_path);
  }
};

/**
 * Track custom events
 */
export const trackEvent = (action: string, category: string, label?: string, value?: number) => {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
    console.log('Event tracked:', category, action, label, value);
  }
};

/**
 * Track competitor added
 */
export const trackCompetitorAdded = (wcaId: string, event: string, resultType: string) => {
  trackEvent('add_competitor', 'graph', `${wcaId} - ${event} - ${resultType}`);
};

/**
 * Track view mode changed
 */
export const trackViewModeChanged = (viewMode: 'raw' | 'unit' | 'percent') => {
  trackEvent('change_view_mode', 'chart', viewMode);
};

/**
 * Track graph comparison
 */
export const trackGraphComparison = (numCompetitors: number, event: string) => {
  trackEvent('compare_competitors', 'graph', `${numCompetitors} competitors - ${event}`, numCompetitors);
};

/**
 * Track search performed
 */
export const trackSearch = (searchQuery: string, resultsCount: number) => {
  trackEvent('search', 'competitor_lookup', searchQuery, resultsCount);
};
