import React from 'react';
import { Box } from 'ink';

import { FeatureSection } from './FeatureSection.js';

export interface PlannedFeature {
  title: string;
  items: string[];
}

const PLANNED_FEATURES: PlannedFeature[] = [
  {
    title: 'OAuth Authentication',
    items: [
      'Secure GitHub account connection',
      'Token management and refresh',
      'Multi-account support',
    ],
  },
  {
    title: 'Repository Operations',
    items: [
      'Clone, fork, and create repositories',
      'Branch management',
      'Commit and push changes',
      'View repository insights',
    ],
  },
  {
    title: 'Issue Management',
    items: [
      'Create and edit issues',
      'Assign labels and milestones',
      'Comment and close issues',
      'Issue search and filtering',
    ],
  },
  {
    title: 'Pull Request Workflow',
    items: [
      'Create and review PRs',
      'Request and provide reviews',
      'Merge and close PRs',
      'View PR status and checks',
    ],
  },
  {
    title: 'Code Review Features',
    items: ['Inline code comments', 'Suggestion mode', 'Review approval workflow', 'Diff viewing'],
  },
  {
    title: 'GitHub Actions',
    items: ['View workflow runs', 'Trigger workflows', 'View logs and artifacts', 'Manage secrets'],
  },
  {
    title: 'Notifications',
    items: [
      'Real-time GitHub notifications',
      'Mention alerts',
      'PR review requests',
      'Issue assignments',
    ],
  },
];

/**
 * PlannedFeaturesList Component
 *
 * Renders the list of planned GitHub features organized by category.
 * Part of the GitHub panel placeholder (Stage-06a).
 *
 * @see .kiro/specs/stage-11-developer-productivity-future-dev/
 */
export const PlannedFeaturesList: React.FC = () => {
  return (
    <Box flexDirection="column">
      {PLANNED_FEATURES.map((feature) => (
        <FeatureSection key={feature.title} title={feature.title} items={feature.items} />
      ))}
    </Box>
  );
};
