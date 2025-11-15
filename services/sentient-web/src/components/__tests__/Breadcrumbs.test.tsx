/**
 * Breadcrumbs Component Tests
 */

import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import Breadcrumbs from '../navigation/Breadcrumbs';

// Helper to render with router
const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('Breadcrumbs', () => {
  it('should render without crashing', () => {
    renderWithRouter(<Breadcrumbs />);
  });

  it('should display breadcrumb items', () => {
    const items = [
      { label: 'Rooms', href: '/rooms' },
      { label: 'Clockwork', href: '/rooms/clockwork' },
    ];

    renderWithRouter(<Breadcrumbs customSegments={items} />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Rooms')).toBeInTheDocument();
    expect(screen.getByText('Clockwork')).toBeInTheDocument();
  });

  it('should make last item non-clickable', () => {
    const items = [
      { label: 'Rooms', href: '/rooms' },
      { label: 'Current Page', href: '/current' },
    ];

    renderWithRouter(<Breadcrumbs customSegments={items} />);

    const dashboardLink = screen.getByText('Dashboard').closest('a');
    const currentPageSpan = screen.getByText('Current Page');

    expect(dashboardLink).toHaveAttribute('href', '/');
    // Last item should be a span, not a link
    expect(currentPageSpan.tagName).toBe('SPAN');
  });
});
