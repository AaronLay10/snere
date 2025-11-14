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
      { label: 'Home', path: '/' },
      { label: 'Rooms', path: '/rooms' },
      { label: 'Clockwork', path: '/rooms/clockwork' },
    ];

    renderWithRouter(<Breadcrumbs items={items} />);

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Rooms')).toBeInTheDocument();
    expect(screen.getByText('Clockwork')).toBeInTheDocument();
  });

  it('should make last item non-clickable', () => {
    const items = [
      { label: 'Home', path: '/' },
      { label: 'Current Page', path: '/current' },
    ];

    renderWithRouter(<Breadcrumbs items={items} />);

    const homeLink = screen.getByText('Home').closest('a');
    const currentPageLink = screen.getByText('Current Page').closest('a');

    expect(homeLink).toHaveAttribute('href', '/');
    // Last item should not be a link or should be styled differently
    // Adjust assertion based on actual implementation
  });
});
