export const DEFAULT_PRINCIPAL_AUTHOR = {
  name: 'Ronel Molina',
  role: 'Principal Cloud Architect · 13+ Years Distributed Systems Experience',
  bio: 'Specializing in high-throughput cloud infrastructure, MLOps automation, and enterprise compliance.'
};

export function buildPrincipalAuthorJsonLd(origin: string) {
  return {
    '@type': 'Person',
    '@id': `${origin}/#author-ronel-molina`,
    name: DEFAULT_PRINCIPAL_AUTHOR.name,
    jobTitle: 'Principal Cloud Architect',
    description: `${DEFAULT_PRINCIPAL_AUTHOR.role}. ${DEFAULT_PRINCIPAL_AUTHOR.bio}`,
    worksFor: {
      '@type': 'Organization',
      name: 'GitStack',
      url: origin
    },
    knowsAbout: [
      'High-Throughput Cloud Infrastructure',
      'Distributed Systems Architecture',
      'MLOps Automation',
      'Enterprise Security & Compliance'
    ]
  };
}
