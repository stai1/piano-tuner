import { useCallback, useEffect, useState } from 'react';
import type { Route } from './context';

const ROUTES: Route[] = ['home', 'check', 'tune', 'raise', 'pianos', 'settings', 'learn'];

function parse(): Route {
  const r = location.hash.replace(/^#\/?/, '') as Route;
  return ROUTES.includes(r) ? r : 'home';
}

// Hash-based routing, so the browser and phone back buttons move between screens.
export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const navigate = useCallback((r: Route) => {
    location.hash = r === 'home' ? '' : `/${r}`;
  }, []);
  return [route, navigate];
}
