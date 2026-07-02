type QrVersionInfo = {
  version: number;
  size: number;
  dataCodewords: number;
  errorCodewords: number;
};

const LOW_ERROR_CORRECTION_FORMAT_BITS = 1;

const QR_VERSIONS: QrVersionInfo[] = [
  { version: 1, size: 21, dataCodewords: 19, errorCodewords: 7 },
  { version: 2, size: 25, dataCodewords: 34, errorCodewords: 10 },
  { version: 3, size: 29, dataCodewords: 55, errorCodewords: 15 },
  { version: 4, size: 33, dataCodewords: 80, errorCodewords: 20 },
  { version: 5, size: 37, dataCodewords: 108, errorCodewords: 26 },
];

const ALIGNMENT_PATTERN_CENTERS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
};

const QR_MASK = 0;

const textEncoder = new TextEncoder();

export const createQrMatrix = (value: string): boolean[][] => {
  const dataBytes = Array.from(textEncoder.encode(value));
  const versionInfo = selectVersion(dataBytes.length);
  const dataCodewords = makeDataCodewords(dataBytes, versionInfo);
  const errorCodewords = makeErrorCodewords(dataCodewords, versionInfo.errorCodewords);
  const codewords = [...dataCodewords, ...errorCodewords];
  const modules = Array.from({ length: versionInfo.size }, () =>
    Array<boolean | null>(versionInfo.size).fill(null)
  );
  const functionModules = Array.from({ length: versionInfo.size }, () =>
    Array<boolean>(versionInfo.size).fill(false)
  );

  const setFunctionModule = (x: number, y: number, isDark: boolean) => {
    if (x < 0 || y < 0 || x >= versionInfo.size || y >= versionInfo.size) {
      return;
    }

    modules[y][x] = isDark;
    functionModules[y][x] = true;
  };

  drawFunctionPatterns(versionInfo, setFunctionModule, functionModules);
  drawCodewords(codewords, modules, functionModules);
  applyMask(modules, functionModules);
  drawFormatBits(versionInfo.size, QR_MASK, setFunctionModule);

  return modules.map((row) => row.map((module) => module === true));
};

const selectVersion = (byteLength: number): QrVersionInfo => {
  const requiredBits = 4 + 8 + byteLength * 8;
  const versionInfo = QR_VERSIONS.find((candidate) => candidate.dataCodewords * 8 >= requiredBits);

  if (!versionInfo) {
    throw new Error('QR value is too long for the built-in pallet QR renderer.');
  }

  return versionInfo;
};

const makeDataCodewords = (dataBytes: number[], versionInfo: QrVersionInfo) => {
  const bits: boolean[] = [];
  const appendBits = (value: number, length: number) => {
    for (let bitIndex = length - 1; bitIndex >= 0; bitIndex--) {
      bits.push(((value >>> bitIndex) & 1) !== 0);
    }
  };
  const capacityBits = versionInfo.dataCodewords * 8;

  appendBits(0b0100, 4);
  appendBits(dataBytes.length, 8);
  dataBytes.forEach((byte) => appendBits(byte, 8));
  appendBits(0, Math.min(4, capacityBits - bits.length));

  while (bits.length % 8 !== 0) {
    bits.push(false);
  }

  const codewords: number[] = [];

  for (let index = 0; index < bits.length; index += 8) {
    let codeword = 0;

    for (let offset = 0; offset < 8; offset++) {
      codeword = (codeword << 1) | (bits[index + offset] ? 1 : 0);
    }

    codewords.push(codeword);
  }

  for (let padIndex = 0; codewords.length < versionInfo.dataCodewords; padIndex++) {
    codewords.push(padIndex % 2 === 0 ? 0xec : 0x11);
  }

  return codewords;
};

const makeErrorCodewords = (dataCodewords: number[], degree: number) => {
  const divisor = makeReedSolomonDivisor(degree);
  const result = Array<number>(degree).fill(0);

  dataCodewords.forEach((codeword) => {
    const factor = codeword ^ result.shift()!;
    result.push(0);

    divisor.forEach((coefficient, index) => {
      result[index] ^= reedSolomonMultiply(coefficient, factor);
    });
  });

  return result;
};

const makeReedSolomonDivisor = (degree: number) => {
  const result = Array<number>(degree).fill(0);
  result[degree - 1] = 1;

  let root = 1;

  for (let index = 0; index < degree; index++) {
    for (let coefficient = 0; coefficient < result.length; coefficient++) {
      result[coefficient] = reedSolomonMultiply(result[coefficient], root);

      if (coefficient + 1 < result.length) {
        result[coefficient] ^= result[coefficient + 1];
      }
    }

    root = reedSolomonMultiply(root, 0x02);
  }

  return result;
};

const reedSolomonMultiply = (x: number, y: number) => {
  let z = 0;

  for (let bitIndex = 7; bitIndex >= 0; bitIndex--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> bitIndex) & 1) * x;
  }

  return z & 0xff;
};

const drawFunctionPatterns = (
  versionInfo: QrVersionInfo,
  setFunctionModule: (x: number, y: number, isDark: boolean) => void,
  functionModules: boolean[][]
) => {
  const size = versionInfo.size;

  drawFinderPattern(3, 3, setFunctionModule);
  drawFinderPattern(size - 4, 3, setFunctionModule);
  drawFinderPattern(3, size - 4, setFunctionModule);

  for (let index = 8; index < size - 8; index++) {
    const isDark = index % 2 === 0;
    setFunctionModule(6, index, isDark);
    setFunctionModule(index, 6, isDark);
  }

  const alignmentCenters = ALIGNMENT_PATTERN_CENTERS[versionInfo.version] || [];

  alignmentCenters.forEach((x) => {
    alignmentCenters.forEach((y) => {
      if (!functionModules[y][x]) {
        drawAlignmentPattern(x, y, setFunctionModule);
      }
    });
  });

  for (let index = 0; index <= 8; index++) {
    if (index !== 6) {
      setFunctionModule(8, index, false);
      setFunctionModule(index, 8, false);
    }
  }

  for (let index = 0; index < 8; index++) {
    setFunctionModule(size - 1 - index, 8, false);
    setFunctionModule(8, size - 1 - index, false);
  }

  setFunctionModule(8, size - 8, true);
};

const drawFinderPattern = (
  centerX: number,
  centerY: number,
  setFunctionModule: (x: number, y: number, isDark: boolean) => void
) => {
  for (let y = centerY - 4; y <= centerY + 4; y++) {
    for (let x = centerX - 4; x <= centerX + 4; x++) {
      const distance = Math.max(Math.abs(x - centerX), Math.abs(y - centerY));
      setFunctionModule(x, y, distance !== 2 && distance !== 4);
    }
  }
};

const drawAlignmentPattern = (
  centerX: number,
  centerY: number,
  setFunctionModule: (x: number, y: number, isDark: boolean) => void
) => {
  for (let y = centerY - 2; y <= centerY + 2; y++) {
    for (let x = centerX - 2; x <= centerX + 2; x++) {
      const distance = Math.max(Math.abs(x - centerX), Math.abs(y - centerY));
      setFunctionModule(x, y, distance !== 1);
    }
  }
};

const drawCodewords = (
  codewords: number[],
  modules: (boolean | null)[][],
  functionModules: boolean[][]
) => {
  const size = modules.length;
  let bitIndex = 0;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) {
      right = 5;
    }

    for (let vertical = 0; vertical < size; vertical++) {
      for (let column = 0; column < 2; column++) {
        const x = right - column;
        const isUpward = ((right + 1) & 2) === 0;
        const y = isUpward ? size - 1 - vertical : vertical;

        if (functionModules[y][x]) {
          continue;
        }

        const codeword = codewords[Math.floor(bitIndex / 8)] || 0;
        modules[y][x] = ((codeword >>> (7 - (bitIndex % 8))) & 1) !== 0;
        bitIndex++;
      }
    }
  }
};

const applyMask = (modules: (boolean | null)[][], functionModules: boolean[][]) => {
  const size = modules.length;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!functionModules[y][x] && (x + y) % 2 === 0) {
        modules[y][x] = modules[y][x] !== true;
      }
    }
  }
};

const drawFormatBits = (
  size: number,
  mask: number,
  setFunctionModule: (x: number, y: number, isDark: boolean) => void
) => {
  const data = (LOW_ERROR_CORRECTION_FORMAT_BITS << 3) | mask;
  let remainder = data;

  for (let index = 0; index < 10; index++) {
    remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * 0x537);
  }

  const bits = ((data << 10) | remainder) ^ 0x5412;
  const getBit = (index: number) => ((bits >>> index) & 1) !== 0;

  for (let index = 0; index <= 5; index++) {
    setFunctionModule(8, index, getBit(index));
  }

  setFunctionModule(8, 7, getBit(6));
  setFunctionModule(8, 8, getBit(7));
  setFunctionModule(7, 8, getBit(8));

  for (let index = 9; index < 15; index++) {
    setFunctionModule(14 - index, 8, getBit(index));
  }

  for (let index = 0; index < 8; index++) {
    setFunctionModule(size - 1 - index, 8, getBit(index));
  }

  for (let index = 8; index < 15; index++) {
    setFunctionModule(8, size - 15 + index, getBit(index));
  }

  setFunctionModule(8, size - 8, true);
};
