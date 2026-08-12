/**
 * Lightweight inline SVG icon set (lucide-style strokes).
 * Each icon is an array of element descriptors: ['path', d] | ['circle', cx, cy, r] | ['rect', x, y, w, h, r]
 */
const E = {
  dashboard: [['path', 'M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z']],
  folder: [['path', 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z']],
  kanban: [['path', 'M6 5v11'], ['path', 'M12 5v6'], ['path', 'M18 5v14']],
  film: [['rect', 2, 2, 20, 20, 3]],
  building: [['rect', 4, 2, 16, 20, 2], ['path', 'M9 22v-4h6v4'], ['path', 'M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01']],
  users: [['path', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'], ['circle', 9, 7, 4], ['path', 'M22 21v-2a4 4 0 0 0-3-3.87'], ['path', 'M16 3.13a4 4 0 0 1 0 7.75']],
  clock: [['circle', 12, 12, 10], ['path', 'M12 6v6l4 2']],
  calendarCheck: [['rect', 3, 4, 18, 18, 2], ['path', 'M16 2v4M8 2v4M3 10h18'], ['path', 'm9 16 2 2 4-4']],
  wallet: [['path', 'M21 12V7H5a2 2 0 0 1 0-4h14v4'], ['path', 'M3 5v14a2 2 0 0 0 2 2h16v-5'], ['path', 'M18 12a2 2 0 0 0 0 4h4v-4Z']],
  shield: [['path', 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z']],
  activity: [['path', 'M22 12h-4l-3 9L9 3l-3 9H2']],
  user: [['path', 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'], ['circle', 12, 7, 4]],
  logout: [['path', 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4'], ['path', 'm16 17 5-5-5-5'], ['path', 'M21 12H9']],
  menu: [['path', 'M4 6h16M4 12h16M4 18h16']],
  search: [['circle', 11, 11, 8], ['path', 'm21 21-4.3-4.3']],
  bell: [['path', 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9'], ['path', 'M10.3 21a1.94 1.94 0 0 0 3.4 0']],
  plus: [['path', 'M12 5v14M5 12h14']],
  chevronDown: [['path', 'm6 9 6 6 6-6']],
  chevronLeft: [['path', 'm15 18-6-6 6-6']],
  chevronRight: [['path', 'm9 18 6-6-6-6']],
  x: [['path', 'M18 6 6 18M6 6l12 12']],
  pencil: [['path', 'M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z']],
  trash: [['path', 'M3 6h18'], ['path', 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6'], ['path', 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2']],
  check: [['path', 'M20 6 9 17l-5-5']],
  checkCircle: [['path', 'M22 11.08V12a10 10 0 1 1-5.93-9.14'], ['path', 'm9 11 3 3L22 4']],
  arrowRight: [['path', 'M5 12h14'], ['path', 'm12 5 7 7-7 7']],
  upload: [['path', 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'], ['path', 'm17 8-5-5-5 5'], ['path', 'M12 3v12']],
  download: [['path', 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'], ['path', 'm7 10 5 5 5-5'], ['path', 'M12 15V3']],
  eye: [['path', 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z'], ['circle', 12, 12, 3]],
  more: [['circle', 12, 5, 1.8], ['circle', 12, 12, 1.8], ['circle', 12, 19, 1.8]],
  filter: [['path', 'M22 3H2l8 9.46V19l4 2v-8.54Z']],
  play: [['path', 'm6 3 14 9-14 9V3z']],
  image: [['rect', 3, 3, 18, 18, 2], ['circle', 9, 9, 2], ['path', 'm21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21']],
  music: [['path', 'M9 18V5l12-2v13'], ['circle', 6, 18, 3], ['circle', 18, 16, 3]],
  file: [['path', 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z'], ['path', 'M14 2v4a2 2 0 0 0 2 2h4']],
  palette: [['path', 'M12 22a10 10 0 1 1 10-10c0 2.21-1.79 4-4 4h-2a2 2 0 0 0-2 2 2 2 0 0 1-2 2 2 2 0 0 0-2 2 2 2 0 0 1-2 2'], ['circle', 7.5, 10.5, 1], ['circle', 12, 7.5, 1], ['circle', 16.5, 10.5, 1]],
  cube: [['path', 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z'], ['path', 'M3.3 7 12 12l8.7-5'], ['path', 'M12 22V12']],
  camera: [['path', 'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z'], ['circle', 12, 13, 4]],
  inbox: [['path', 'M22 12h-6l-2 3h-4l-2-3H2'], ['path', 'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z']],
  calendar: [['rect', 3, 4, 18, 18, 2], ['path', 'M16 2v4M8 2v4M3 10h18']],
  briefcase: [['rect', 2, 7, 20, 14, 2], ['path', 'M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16']],
  mapPin: [['path', 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z'], ['circle', 12, 10, 3]],
  phone: [['path', 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z']],
  mail: [['rect', 2, 4, 20, 16, 2], ['path', 'm22 7-10 5L2 7']],
  zap: [['path', 'M13 2 3 14h9l-1 8 10-12h-9l1-8z']],
  target: [['circle', 12, 12, 10], ['circle', 12, 12, 6], ['circle', 12, 12, 2]],
  trendingUp: [['path', 'M22 7 13.5 15.5 8.5 10.5 2 17'], ['path', 'M16 7h6v6']],
  refresh: [['path', 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8'], ['path', 'M21 3v5h-5'], ['path', 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16'], ['path', 'M8 16H3v5']],
  layers: [['path', 'm12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z'], ['path', 'm22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65'], ['path', 'm22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65']],
  sparkles: [['path', 'M12 3l1.9 5.7L19.6 10l-5.7 1.9L12 17.6l-1.9-5.7L4.4 10l5.7-1.9z'], ['path', 'M19 15l.9 2.6L22.5 18l-2.6.9L19 21.5l-.9-2.6L15.5 18l2.6-.9z']],
  lock: [['rect', 3, 11, 18, 11, 2], ['path', 'M7 11V7a5 5 0 0 1 10 0v4']],
  globe: [['circle', 12, 12, 10], ['path', 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20'], ['path', 'M2 12h20']],
  alert: [['path', 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3'], ['path', 'M12 9v4'], ['path', 'M12 17h.01']],
  send: [['path', 'M22 2 11 13'], ['path', 'M22 2 15 22l-4-9-9-4Z']],
  hourglass: [['path', 'M5 22h14'], ['path', 'M5 2h14'], ['path', 'M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22'], ['path', 'M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2']],
  crown: [['path', 'M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.735H5.81a1 1 0 0 1-.957-.735L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z'], ['path', 'M5 21h14']],
  banknote: [['rect', 2, 6, 20, 12, 2], ['circle', 12, 12, 2], ['path', 'M6 12h.01M18 12h.01']],
  scale: [['path', 'm16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z'], ['path', 'm2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z'], ['path', 'M7 21h10'], ['path', 'M12 3v18'], ['path', 'M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2']],
  sun: [['circle', 12, 12, 4], ['path', 'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41']],
  barChart: [['path', 'M3 3v18h18'], ['path', 'M18 17V9'], ['path', 'M13 17V5'], ['path', 'M8 17v-3']],
  pieChart: [['path', 'M21.21 15.89A10 10 0 1 1 8 2.83'], ['path', 'M22 12A10 10 0 0 0 12 2v10z']],
  circle: [['circle', 12, 12, 10]],
  heart: [['path', 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z']],
  ring: [['path', 'M6 11.5a6 6 0 1 1 12 0c0 5.2 2.2 6.5 2.2 6.5H3.8S6 16.7 6 11.5'], ['path', 'M10 21a2 2 0 0 0 4 0']],
};

export function Icon({ name, size = 18, strokeWidth = 2, className = '', ...rest }) {
  const def = E[name] || E.circle;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true" {...rest}
    >
      {def.map((el, i) => {
        if (el[0] === 'path') return <path key={i} d={el[1]} />;
        if (el[0] === 'circle') return <circle key={i} cx={el[1]} cy={el[2]} r={el[3]} />;
        if (el[0] === 'rect') return <rect key={i} x={el[1]} y={el[2]} width={el[3]} height={el[4]} rx={el[5] || 0} />;
        return null;
      })}
    </svg>
  );
}

export const ASSET_ICONS = { video: 'film', image: 'image', audio: 'music', document: 'file', design: 'palette', '3d': 'cube' };
export const ASSET_COLORS = { video: '#3b82f6', image: '#10b981', audio: '#f59e0b', document: '#8b5cf6', design: '#ec4899', '3d': '#6366f1' };
