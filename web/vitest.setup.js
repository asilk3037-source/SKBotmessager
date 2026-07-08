import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Vitest doesn't auto-detect testing-library's implicit cleanup hook the way Jest does,
// so without this, every render() leaks into the DOM of the next test in the same file.
afterEach(cleanup);
