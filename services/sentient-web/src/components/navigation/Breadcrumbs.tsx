import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbSegment {
  label: string;
  href: string;
}

interface BreadcrumbsProps {
  customSegments?: BreadcrumbSegment[];
  className?: string;
}

export default function Breadcrumbs({ customSegments, className = '' }: BreadcrumbsProps) {
  const location = useLocation();
  
  // Generate breadcrumbs from pathname or use custom segments
  const segments: BreadcrumbSegment[] = customSegments || generateSegmentsFromPath(location.pathname);
  
  return (
    <nav 
      className={`flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-6 ${className}`}
      aria-label="Breadcrumb"
    >
      <Link 
        to="/" 
        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium"
        aria-label="Dashboard"
      >
        Dashboard
      </Link>
      
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        
        return (
          <div key={segment.href} className="flex items-center space-x-2">
            <ChevronRight className="w-4 h-4 text-gray-400" aria-hidden="true" />
            {isLast ? (
              <span 
                className="font-medium text-gray-900 dark:text-gray-100"
                aria-current="page"
              >
                {segment.label}
              </span>
            ) : (
              <Link
                to={segment.href}
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors hover:underline"
              >
                {segment.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function generateSegmentsFromPath(pathname: string): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [];
  const parts = pathname.split('/').filter(Boolean);
  
  let href = '';
  
  parts.forEach((part) => {
    href += `/${part}`;
    
    // Format label (capitalize, replace hyphens)
    let label = part
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    // Special cases for known routes
    const routeLabels: Record<string, string> = {
      rooms: 'Rooms',
      scenes: 'Scenes',
      devices: 'Devices',
      controllers: 'Controllers',
      clockwork: 'Clockwork',
      mythra: 'Mythra',
    };
    
    if (routeLabels[part.toLowerCase()]) {
      label = routeLabels[part.toLowerCase()];
    }
    
    segments.push({ label, href });
  });
  
  return segments;
}
