/**
 * External source portals (the real ZMU demo environment).
 * The dashboard links out to these rather than re-implementing them — the
 * differentiator here is the AI advisory layer sitting on top.
 * Base: http://zmudemo-la.uaenorth.cloudapp.azure.com
 */
const H = 'http://zmudemo-la.uaenorth.cloudapp.azure.com';
const HS = 'https://zmudemo-la.uaenorth.cloudapp.azure.com';

export const PORTALS = {
  academic: [
    { label: 'Student Information System', port: 8081, url: `${H}:8081/` },
    { label: 'Moodle LMS', port: 8082, url: `${H}:8082/login/index.php` },
    { label: 'Cadet Experience Portal', port: 8085, url: `${H}:8085/login` },
  ],
  readiness: [
    { label: 'HPO Fitness & Readiness', port: 8086, url: `${H}:8086/` },
    { label: 'Military Training Record', port: 8087, url: `${H}:8087/` },
    { label: 'Conduct & Discipline Register', port: 8088, url: `${H}:8088/` },
  ],
  enterprise: [
    { label: 'API Manager — Dev Portal', port: 9443, url: `${HS}:9443/devportal` },
    { label: 'Environment Launchpad', port: 8000, url: `${H}:8000/` },
  ],
  campus: [
    { label: 'Micro Integrator — Ops', port: 9164, url: `${HS}:9164/management` },
    { label: 'Environment Launchpad', port: 8000, url: `${H}:8000/` },
  ],
};
