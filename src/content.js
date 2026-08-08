// ============================================================
//  SAARA PORTFOLIO CONTENT YAHAN HAI — bas is file ko edit kar!
//  (All portfolio content lives here — just edit this file.)
// ============================================================

export const content = {
  name: 'Sidharath',
  title: 'Site Reliability Engineer · AI Agent Builder',
  tagline: 'Drive around and explore my world!',

  about: {
    // Floor pe likha hua bio — short lines rakhna (yeh 3D floor pe render hota hai)
    lines: [
      'I keep large-scale',
      'platforms running —',
      'and I build AI agents',
      'that make whole teams',
      'faster at it.',
    ],
    // Yeh crates ban ke world mein girte hain — takra ke maza aata hai
    skills: ['Azure', 'KQL', 'Grafana', 'Terraform', 'K8s', 'Node', 'Python', 'AI Agents'],
  },

  projects: [
    {
      title: 'Jarvis — Agentic SRE',
      tech: 'LLM Agents · Azure Bot · Node.js',
      description: 'An AI teammate in Microsoft Teams that traces production incidents across platform logs — managed-identity auth, read-only skills, grounded knowledge. Any engineer triages like the most experienced one.',
      url: 'https://github.com/reflex000/agentic-sre',
    },
    {
      title: 'AlertFlow — Alerting Framework',
      tech: 'Azure Logic Apps · ServiceNow · Teams',
      description: 'One alerting pipeline for any source — Splunk, Okta, Veeam, Control-M… Receivers normalize to one contract; one processor correlates, opens and auto-resolves incidents, and routes cards to the right channel.',
      url: 'https://github.com/reflex000/alertflow',
    },
    {
      title: 'Observability Dashboards',
      tech: 'Grafana · Azure Monitor · KQL',
      description: 'Dashboards that follow one request across every platform layer — API-to-Core journey, surge detection, customer-UUID incident triage, session tracing. Built from real incident patterns.',
      url: 'https://github.com/reflex000/observability',
    },
    {
      title: 'This Website',
      tech: 'Three.js · cannon-es · Vite',
      description: 'A drivable 3D portfolio inspired by Bruno Simon — physics, popups and flying skill crates included. Go on, do a burnout on my About section.',
      url: 'https://github.com/reflex000/portfolio',
    },
  ],

  socials: {
    github: 'https://github.com/reflex000',
    linkedin: 'https://www.linkedin.com/', // TODO: apna exact profile URL de dena, update kar dunga
    email: 'ss.sidharath@gmail.com',
    resume: '', // resume PDF ka link (khaali chhoda to pad nahi banega)
  },
}
