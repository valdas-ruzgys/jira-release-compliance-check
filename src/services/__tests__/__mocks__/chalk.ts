// Mock chalk for Jest tests
const mockChalkFunction = (text: string) => text;

const mockChalk: any = Object.assign(mockChalkFunction, {
  red: mockChalkFunction,
  green: mockChalkFunction,
  yellow: mockChalkFunction,
  blue: mockChalkFunction,
  magenta: mockChalkFunction,
  cyan: mockChalkFunction,
  white: mockChalkFunction,
  gray: mockChalkFunction,
  grey: mockChalkFunction,
  bold: {
    cyan: mockChalkFunction,
    blue: mockChalkFunction,
  },
  dim: mockChalkFunction,
});

export default mockChalk;
