import { useEffect } from 'react';

// Google Analytics tracking ID - REPLACE WITH YOUR ACTUAL GA4 MEASUREMENT ID
// TODO: Update this with your real Google Analytics 4 Measurement ID
// To get your ID: https://support.google.com/analytics/answer/9539598
const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX'; // Replace with your actual GA4 measurement ID

/**
 * Google Analytics Provider Component
 * Initializes gtag.js for Google Analytics 4 tracking
 */
export function GoogleAnalytics() {
  useEffect(() => {
    // Only initialize in production
    if (import.meta.env.PROD) {
      // Load gtag.js script
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;

      document.head.appendChild(script);

      // Initialize gtag
      (window as any).dataLayer = (window as any).dataLayer || [];

      // Configure gtag
      (window as any).gtag('js', new Date());
      (window as any).gtag('config', GA_MEASUREMENT_ID, {
        // Enable debug mode in development
        'debug_mode': false,
        // Send page view without a title override
        'anonymize_ip': true, // Anonymize IP addresses for privacy
        'cookie_flags': 'samesite=none;secure', // Cookie settings
      });

      console.log('Google Analytics initialized with ID:', GA_MEASUREMENT_ID);
    }
  }, []);

  return null; // This component doesn't render anything
}

/**
 * Track page views
 */
export const trackPageView = (page_title: string, page_location: string, page_path: string) => {
  if (import.meta.env.PROD && typeof window !== 'undefined' && (window as any).gtag) {
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
  if (import.meta.env.PROD && typeof window !== 'undefined' && (window as any).gtag) {
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
