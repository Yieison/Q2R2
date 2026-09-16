export const defaultQrStyle = {
  size: 256,
  bgColor: '#ffffff',
  fgColor: '#000000',
  level: 'M',
  includeMargin: true,
  dotStyle: 'square',
  cornerSquareStyle: 'square',
  cornerSquareColor: '#000000',
  cornerDotStyle: 'dot',
  useGradient: false,
  gradient: {
    type: 'linear',
    from: '#0ea5e9',
    to: '#0369a1',
    rotation: 45,
  },
  logo: {
    enabled: false,
    src: '',
    size: 0.32,
    margin: 6,
    hideBackgroundDots: true,
    syncColors: false,
    hasTransparentBackground: false,
    usePlate: false,
    renderSrc: '',
  },
}

const computeDotsOptions = (style) => {
  if (style.useGradient) {
    return {
      type: style.dotStyle,
      gradient: {
        type: style.gradient.type,
        rotation: (style.gradient.rotation * Math.PI) / 180,
        colorStops: [
          { offset: 0, color: style.gradient.from },
          { offset: 1, color: style.gradient.to },
        ],
      },
    }
  }

  return {
    type: style.dotStyle,
    color: style.fgColor,
  }
}

export const buildQrOptions = (data, style, overrideSize) => {
  const logoSrc =
    style.logo.usePlate && style.logo.renderSrc ? style.logo.renderSrc : style.logo.src
  const size = overrideSize || style.size

  return {
    width: size,
    height: size,
    data: data || ' ',
    margin: style.includeMargin ? 16 : 0,
    qrOptions: {
      errorCorrectionLevel: style.level,
    },
    backgroundOptions: {
      color: style.bgColor,
    },
    dotsOptions: computeDotsOptions(style),
    cornersSquareOptions: {
      color: style.cornerSquareColor || style.fgColor,
      type: style.cornerSquareStyle,
    },
    cornersDotOptions: {
      color: style.fgColor,
      type: style.cornerDotStyle,
    },
    image: style.logo.enabled && logoSrc ? logoSrc : undefined,
    imageOptions: {
      hideBackgroundDots: style.logo.usePlate ? false : style.logo.hideBackgroundDots,
      imageSize: Math.min(style.logo.size, style.logo.usePlate ? 0.36 : 0.38),
      margin: style.logo.usePlate ? 0 : style.logo.margin,
      crossOrigin: 'anonymous',
    },
  }
}
