/**
 * @author Pascal Getreuer 2005-2010 <getreuer@gmail.com>
 * @author Zehir 2021 <zehir@zorim.fr>
 *
 * == Summary ==
 * This file implements routines for color transformations between the spaces
 * sRGB, Y'UV, Y'CbCr, Y'PbPr, Y'DbDr, Y'IQ, HSV, HSL, HSI, CIEXYZ, CIELAB,
 * CIELUV, CIELCH, and CIECAT02 LMS.
 *
 *
 * == References ==
 * Based on https://github.com/dresden-elektronik/deconz-rest-plugin/blob/master/colorspace.cpp
 *
 * The definitions of these spaces and the many of the transformation formulas
 * can be found in
 *
 *    Poynton, "Frequently Asked Questions About Gamma"
 *    http://www.poynton.com/notes/colour_and_gamma/GammaFAQ.html
 *
 *    Poynton, "Frequently Asked Questions About Color"
 *    http://www.poynton.com/notes/colour_and_gamma/ColorFAQ.html
 *
 * and Wikipedia articles
 *    http://en.wikipedia.org/wiki/SRGB
 *    http://en.wikipedia.org/wiki/YUV
 *    http://en.wikipedia.org/wiki/YCbCr
 *    http://en.wikipedia.org/wiki/YPbPr
 *    http://en.wikipedia.org/wiki/YDbDr
 *    http://en.wikipedia.org/wiki/YIQ
 *    http://en.wikipedia.org/wiki/HSL_and_HSV
 *    http://en.wikipedia.org/wiki/CIE_1931_color_space
 *    http://en.wikipedia.org/wiki/Lab_color_space
 *    http://en.wikipedia.org/wiki/CIELUV_color_space
 *    http://en.wikipedia.org/wiki/LMS_color_space
 *
 * == License (BSD) ==
 * Copyright (c) 2005-2010, Pascal Getreuer
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * - Redistributions of source code must retain the above copyright
 *   notice, this list of conditions and the following disclaimer.
 * - Redistributions in binary form must reproduce the above copyright
 *   notice, this list of conditions and the following disclaimer in
 *   the documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */


const Colorspace = {};

/** @brief XYZ color of the D65 white point */
Colorspace.WHITEPOINT_X = 0.950456;
Colorspace.WHITEPOINT_Y = 1.0;
Colorspace.WHITEPOINT_Z = 1.088754;

/** @brief u'v' coordinates of the white point for CIE Lu*v* */
Colorspace.WHITEPOINT_U = ((4 * Colorspace.WHITEPOINT_X) / (Colorspace.WHITEPOINT_X + 15 * Colorspace.WHITEPOINT_Y + 3 * Colorspace.WHITEPOINT_Z));
Colorspace.WHITEPOINT_V = ((9 * Colorspace.WHITEPOINT_Y) / (Colorspace.WHITEPOINT_X + 15 * Colorspace.WHITEPOINT_Y + 3 * Colorspace.WHITEPOINT_Z));

/** @brief Min of A and B */
Colorspace.MIN = (A, B) => (((A) <= (B)) ? (A) : (B));

/** @brief Max of A and B */
Colorspace.MAX = (A, B) => (((A) >= (B)) ? (A) : (B));

/** @brief Min of A, B, and C */
Colorspace.MIN3 = (A, B, C) => (((A) <= (B)) ? Colorspace.MIN(A, C) : Colorspace.MIN(B, C));

/** @brief Max of A, B, and C */
Colorspace.MAX3 = (A, B, C) => (((A) >= (B)) ? Colorspace.MAX(A, C) : Colorspace.MAX(B, C));

/** @brief The constant pi */
Colorspace.M_PI = 3.14159265358979323846264338327950288;

/**
 * @brief sRGB gamma correction, transforms R to R'
 * http://en.wikipedia.org/wiki/SRGB
 */
Colorspace.GAMMACORRECTION = (t) => (
    ((t) <= 0.0031306684425005883) ?
        (12.92 * (t)) :
        (1.055 * Math.pow((t), 0.416666666666666667) - 0.055)
);

/**
 * @brief Inverse sRGB gamma correction, transforms R' to R
 */
Colorspace.INVGAMMACORRECTION = (t) => (
    ((t) <= 0.0404482362771076) ?
        ((t) / 12.92) :
        Math.pow(((t) + 0.055) / 1.055, 2.4)
);

/**
 * @brief CIE L*a*b* f function (used to convert XYZ to L*a*b*)
 * http://en.wikipedia.org/wiki/Lab_color_space
 */
Colorspace.LABF = (t) => (
    (t >= 8.85645167903563082e-3) ?
        Math.pow(t, 0.333333333333333) :
        (841.0 / 108.0) * (t) + (4.0 / 29.0)
);

/**
 * @brief CIE L*a*b* inverse f function
 * http://en.wikipedia.org/wiki/Lab_color_space
 */
Colorspace.LABINVF = (t) => (
    (t >= 0.206896551724137931) ?
        ((t) * (t) * (t)) :
        (108.0 / 841.0) * ((t) - (4.0 / 29.0))
);

/*
 * == Linear color transformations ==
 *
 * The following routines implement transformations between sRGB and
 * the linearly-related color spaces Y'UV, Y'PbPr, Y'DbDr, and Y'IQ.
 */

/**
 * @brief Convert sRGB to NTSC/PAL Y'UV Luma + Chroma
 *
 * Wikipedia: http://en.wikipedia.org/wiki/YUV
 */
Colorspace.Rgb2Yuv = (R, G, B) => {
    return {
        Y: (0.299 * R + 0.587 * G + 0.114 * B),
        U: (-0.147 * R - 0.289 * G + 0.436 * B),
        V: (0.615 * R - 0.515 * G - 0.100 * B)
    };
};

/** @brief Convert NTSC/PAL Y'UV to sRGB */
Colorspace.Yuv2Rgb = (Y, U, V) => {
    return {
        R: (Y - 3.945707070708279e-05 * U + 1.1398279671717170825 * V),
        G: (Y - 0.3946101641414141437 * U - 0.5805003156565656797 * V),
        B: (Y + 2.0319996843434342537 * U - 4.813762626262513e-04 * V)
    };
};

/** @brief sRGB to Y'CbCr Luma + Chroma */
Colorspace.Rgb2Ycbcr = (R, G, B) => {
    return {
        Y: (65.481 * R + 128.553 * G + 24.966 * B + 16),
        Cb: (-37.797 * R - 74.203 * G + 112.0 * B + 128),
        Cr: (112.0 * R - 93.786 * G - 18.214 * B + 128)
    };
};

/** @brief Y'CbCr to sRGB */
Colorspace.Ycbcr2Rgb = (Y, Cr, Cb) => {
    Y -= 16;
    Cb -= 128;
    Cr -= 128;
    return {
        R: (0.00456621004566210107 * Y + 1.1808799897946415e-09 * Cr + 0.00625892896994393634 * Cb),
        G: (0.00456621004566210107 * Y - 0.00153632368604490212 * Cr - 0.00318811094965570701 * Cb),
        B: (0.00456621004566210107 * Y + 0.00791071623355474145 * Cr + 1.1977497040190077e-08 * Cb)
    };
};

/** @brief sRGB to JPEG-Y'CbCr Luma + Chroma */
Colorspace.Rgb2Jpegycbcr = (R, G, B) => {
    let C1 = Colorspace.Rgb2Ypbpr(R, G, B);
    return {
        Y: C1.Y,
        Cb: C1.Pb + 0.5,
        Cr: C1.Pr + 0.5
    };
};

/** @brief JPEG-Y'CbCr to sRGB */
Colorspace.Jpegycbcr2Rgb = (Y, Cb, Cr) => {
    Cb -= 0.5;
    Cr -= 0.5;
    return Colorspace.Ypbpr2Rgb(Y, Cb, Cr);
};

/** @brief sRGB to Y'PbPr Luma (ITU-R BT.601) + Chroma */
Colorspace.Rgb2Ypbpr = (R, G, B) => {
    return {
        Y: (0.299 * R + 0.587 * G + 0.114 * B),
        Pb: (-0.1687367 * R - 0.331264 * G + 0.5 * B),
        Pr: (0.5 * R - 0.418688 * G - 0.081312 * B)
    };
};

/** @brief Y'PbPr to sRGB */
Colorspace.Ypbpr2Rgb = (Y, Pb, Pr) => {
    return {
        R: (0.99999999999914679361 * Y - 1.2188941887145875e-06 * Pb + 1.4019995886561440468 * Pr),
        G: (0.99999975910502514331 * Y - 0.34413567816504303521 * Pb - 0.71413649331646789076 * Pr),
        B: (1.00000124040004623180 * Y + 1.77200006607230409200 * Pb + 2.1453384174593273e-06 * Pr)
    };
};

/** @brief sRGB to SECAM Y'DbDr Luma + Chroma */
Colorspace.Rgb2Ydbdr = (R, G, B) => {
    return {
        Y: (0.299 * R + 0.587 * G + 0.114 * B),
        Db: (-0.450 * R - 0.883 * G + 1.333 * B),
        Dr: (-1.333 * R + 1.116 * G + 0.217 * B)
    };
};

/** @brief SECAM Y'DbDr to sRGB */
Colorspace.Ydbdr2Rgb = (Y, Db, Dr) => {
    return {
        R: (Y + 9.2303716147657e-05 * Db - 0.52591263066186533 * Dr),
        G: (Y - 0.12913289889050927 * Db + 0.26789932820759876 * Dr),
        B: (Y + 0.66467905997895482 * Db - 7.9202543533108e-05 * Dr)
    };
};

/** @brief sRGB to NTSC YIQ */
Colorspace.Rgb2Yiq = (R, G, B) => {
    return {
        Y: (0.299 * R + 0.587 * G + 0.114 * B),
        I: (0.595716 * R - 0.274453 * G - 0.321263 * B),
        Q: (0.211456 * R - 0.522591 * G + 0.311135 * B)
    };
};

/** @brief Convert NTSC YIQ to sRGB */
Colorspace.Yiq2Rgb = (Y, I, Q) => {
    return {
        R: (Y + 0.9562957197589482261 * I + 0.6210244164652610754 * Q),
        G: (Y - 0.2721220993185104464 * I - 0.6473805968256950427 * Q),
        B: (Y - 1.1069890167364901945 * I + 1.7046149983646481374 * Q),
    };
};

/*
 * == Hue Saturation Value/Lightness/Intensity color transformations ==
 *
 * The following routines implement transformations between sRGB and
 * color spaces HSV, HSL, and HSI.
 */

/**
 * @brief Convert an sRGB color to Hue-Saturation-Value (HSV)
 *
 * @param R the input sRGB values scaled in [0,1]
 * @param G the input sRGB values scaled in [0,1]
 * @param B the input sRGB values scaled in [0,1]
 *
 * This routine transforms from sRGB to the hexcone HSV color space.  The
 * sRGB values are assumed to be between 0 and 1.  The output values are
 *   H = hexagonal hue angle   (0 <= H < 360),
 *   S = C/V                   (0 <= S <= 1),
 *   V = max(R',G',B')         (0 <= V <= 1),
 * where C = max(R',G',B') - min(R',G',B').  The inverse color transformation
 * is given by Hsv2Rgb.
 *
 * Wikipedia: http://en.wikipedia.org/wiki/HSL_and_HSV
 */
Colorspace.Rgb2Hsv = (R, G, B) => {
    let H, S, V;
    let Max = Colorspace.MAX3(R, G, B);
    let Min = Colorspace.MIN3(R, G, B);
    let C = Max - Min;

    V = Max;

    if (C > 0) {
        if (Max === R) {
            H = (G - B) / C;
            if (G < B) H += 6;
        } else if (Max === G) {
            H = 2 + (B - R) / C;
        } else {
            H = 4 + (R - G) / C;
        }

        H *= 60;
        S = C / Max;
    } else {
        H = S = 0;
    }
    return {H, S, V};
};

/**
 * @brief Convert a Hue-Saturation-Value (HSV) color to sRGB
 *
 * @param H the input HSV values
 * @param S the input HSV values
 * @param V the input HSV values
 *
 * The input values are assumed to be scaled as
 *    0 <= H < 360,
 *    0 <= S <= 1,
 *    0 <= V <= 1.
 * The output sRGB values are scaled between 0 and 1.
 * This is the inverse transformation of Rgb2Hsv.
 *
 * Wikipedia: http://en.wikipedia.org/wiki/HSL_and_HSV
 */
Colorspace.Hsv2Rgb = (H, S, V) => {
    let R, G, B;
    let C = S * V;
    let Min = V - C;
    let X;

    H -= 360 * Math.floor(H / 360);
    H /= 60;
    X = C * (1 - Math.abs(H - 2 * Math.floor(H / 2) - 1));

    switch (Math.round(H)) {
        case 0:
            R = Min + C;
            G = Min + X;
            B = Min;
            break;
        case 1:
            R = Min + X;
            G = Min + C;
            B = Min;
            break;
        case 2:
            R = Min;
            G = Min + C;
            B = Min + X;
            break;
        case 3:
            R = Min;
            G = Min + X;
            B = Min + C;
            break;
        case 4:
            R = Min + X;
            G = Min;
            B = Min + C;
            break;
        case 5:
            R = Min + C;
            G = Min;
            B = Min + X;
            break;
        default:
            R = G = B = 0;
    }
    return {R, G, B};
};

/**
 * @brief Convert an sRGB color to Hue-Saturation-Lightness (HSL)
 *
 * @param R the input sRGB values scaled in [0,1]
 * @param G the input sRGB values scaled in [0,1]
 * @param B the input sRGB values scaled in [0,1]
 *
 * This routine transforms from sRGB to the double hexcone HSL color space
 * The sRGB values are assumed to be between 0 and 1.  The outputs are
 *   H = hexagonal hue angle                (0 <= H < 360),
 *   S = { C/(2L)     if L <= 1/2           (0 <= S <= 1),
 *       { C/(2 - 2L) if L >  1/2
 *   L = (max(R',G',B') + min(R',G',B'))/2  (0 <= L <= 1),
 * where C = max(R',G',B') - min(R',G',B').  The inverse color transformation
 * is given by Hsl2Rgb.
 *
 * Wikipedia: http://en.wikipedia.org/wiki/HSL_and_HSV
 */
Colorspace.Rgb2Hsl = (R, G, B) => {
    let H, S, L;

    let Max = Colorspace.MAX3(R, G, B);
    let Min = Colorspace.MIN3(R, G, B);
    let C = Max - Min;
    L = (Max + Min) / 2;

    if (C > 0) {
        if (Max === R) {
            H = (G - B) / C;
            if (G < B) H += 6;
        } else if (Max === G) {
            H = 2 + (B - R) / C;
        } else {
            H = 4 + (R - G) / C;
        }
        H *= 60;
        S = (L <= 0.5) ? (C / (2 * (L))) : (C / (2 - 2 * (L)));
    } else {
        H = S = 0;
    }

    return {H, S, L};
};

/**
 * @brief Convert a Hue-Saturation-Lightness (HSL) color to sRGB
 *
 * @param H the input HSL values
 * @param S the input HSL values
 * @param L the input HSL values
 *
 * The input values are assumed to be scaled as
 *    0 <= H < 360,
 *    0 <= S <= 1,
 *    0 <= L <= 1.
 * The output sRGB values are scaled between 0 and 1.  This is the inverse
 * transformation of Rgb2Hsl.
 *
 * Wikipedia: http://en.wikipedia.org/wiki/HSL_and_HSV
 */
Colorspace.Hsl2Rgb = (H, S, L) => {
    let R, G, B;
    let C = (L <= 0.5) ? (2 * L * S) : ((2 - 2 * L) * S);
    let Min = L - 0.5 * C;
    let X;

    H -= 360 * floor(H / 360);
    H /= 60;
    X = C * (1 - Math.abs(H - 2 * floor(H / 2) - 1));

    switch (Math.round(H)) {
        case 0:
            R = Min + C;
            G = Min + X;
            B = Min;
            break;
        case 1:
            R = Min + X;
            G = Min + C;
            B = Min;
            break;
        case 2:
            R = Min;
            G = Min + C;
            B = Min + X;
            break;
        case 3:
            R = Min;
            G = Min + X;
            B = Min + C;
            break;
        case 4:
            R = Min + X;
            G = Min;
            B = Min + C;
            break;
        case 5:
            R = Min + C;
            G = Min;
            B = Min + X;
            break;
        default:
            R = G = B = 0;
    }
    return {R, G, B};
};

/**
 * @brief Convert an sRGB color to Hue-Saturation-Intensity (HSI)
 *
 * @param R the input sRGB values scaled in [0,1]
 * @param G the input sRGB values scaled in [0,1]
 * @param B the input sRGB values scaled in [0,1]
 *
 * This routine transforms from sRGB to the cylindrical HSI color space.  The
 * sRGB values are assumed to be between 0 and 1.  The output values are
 *   H = polar hue angle         (0 <= H < 360),
 *   S = 1 - min(R',G',B')/I     (0 <= S <= 1),
 *   I = (R'+G'+B')/3            (0 <= I <= 1).
 * The inverse color transformation is given by Hsi2Rgb.
 *
 * Wikipedia: http://en.wikipedia.org/wiki/HSL_and_HSV
 */
Colorspace.Rgb2Hsi = (R, G, B) => {
    let H, S, I;
    let alpha = 0.5 * (2 * R - G - B);
    let beta = 0.866025403784439 * (G - B);
    I = (R + G + B) / 3;
    if (I > 0) {
        S = 1 - Colorspace.MIN3(R, G, B) / I;
        H = Math.atan2(beta, alpha) * (180 / Colorspace.M_PI);
        if (H < 0) H += 360;
    } else {
        H = S = 0;
    }
    return {H, S, I};
};

/**
 * @brief Convert a Hue-Saturation-Intesity (HSI) color to sRGB
 *
 * @param H the input HSI values
 * @param S the input HSI values
 * @param I the input HSI values
 *
 * The input values are assumed to be scaled as
 *    0 <= H < 360,
 *    0 <= S <= 1,
 *    0 <= I <= 1.
 * The output sRGB values are scaled between 0 and 1.  This is the inverse
 * transformation of Rgb2Hsi.
 *
 * Wikipedia: http://en.wikipedia.org/wiki/HSL_and_HSV
 */
Colorspace.Hsi2Rgb = (H, S, I) => {
    let R, G, B;
    H -= 360 * Math.floor(H / 360);
    if (H < 120) {
        B = I * (1 - S);
        R = I * (1 + S * Math.cos(H * (Colorspace.M_PI / 180)) / Math.cos((60 - H) * (Colorspace.M_PI / 180)));
        G = 3 * I - R - B;
    } else if (H < 240) {
        H -= 120;
        R = I * (1 - S);
        G = I * (1 + S * Math.cos(H * (Colorspace.M_PI / 180)) / Math.cos((60 - H) * (Colorspace.M_PI / 180)));
        B = 3 * I - R - G;
    } else {
        H -= 240;
        G = I * (1 - S);
        B = I * (1 + S * Math.cos(H * (Colorspace.M_PI / 180)) / Math.cos((60 - H) * (Colorspace.M_PI / 180)));
        R = 3 * I - G - B;
    }
    return {R, G, B};
};

/*
 * == CIE color transformations ==
 *
 * The following routines implement transformations between sRGB and
 * the CIE color spaces XYZ, L*a*b, L*u*v*, and L*C*H*.  These
 * transforms assume a 2 degree observer angle and a D65 illuminant.
 */

/**
 * @brief Transform sRGB to CIE XYZ with the D65 white point
 *
 * @param R the input sRGB values
 * @param G the input sRGB values
 * @param B the input sRGB values
 *
 * Poynton, "Frequently Asked Questions About Color," page 10
 * Wikipedia: http://en.wikipedia.org/wiki/SRGB
 * Wikipedia: http://en.wikipedia.org/wiki/CIE_1931_color_space
 */
Colorspace.Rgb2Xyz = (R, G, B) => {
    R = Colorspace.INVGAMMACORRECTION(R);
    G = Colorspace.INVGAMMACORRECTION(G);
    B = Colorspace.INVGAMMACORRECTION(B);
    return {
        X: (0.4123955889674142161 * R + 0.3575834307637148171 * G + 0.1804926473817015735 * B),
        Y: (0.2125862307855955516 * R + 0.7151703037034108499 * G + 0.07220049864333622685 * B),
        Z: (0.01929721549174694484 * R + 0.1191838645808485318 * G + 0.9504971251315797660 * B)
    };
};

/**
 * @brief Transform sRGB to xy
 *
 * @param R the input sRGB values
 * @param G the input sRGB values
 * @param B the input sRGB values
 */
Colorspace.Rgb2Xy = (R, G, B) => {
    let C1 = Colorspace.Rgb2Xyz(R, G, B);
    let C2 = Colorspace.Xyz2Xyb(C1.X, C1.Y, C1.Z);
    return {
        X: C2.X,
        Y: C2.Y
    };
};

/**
 * @brief Transform CIE XYZ to sRGB with the D65 white point
 *
 * @param X the input XYZ values
 * @param Y the input XYZ values
 * @param Z the input XYZ values
 *
 * Official sRGB specification (IEC 61966-2-1:1999)
 * Poynton, "Frequently Asked Questions About Color," page 10
 * Wikipedia: http://en.wikipedia.org/wiki/SRGB
 * Wikipedia: http://en.wikipedia.org/wiki/CIE_1931_color_space
 */
Colorspace.Xyz2Rgb = (X, Y, Z) => {
    let R, G, B;
    let R1, B1, G1, Min;

    R1 = (3.2406 * X - 1.5372 * Y - 0.4986 * Z);
    G1 = (-0.9689 * X + 1.8758 * Y + 0.0415 * Z);
    B1 = (0.0557 * X - 0.2040 * Y + 1.0570 * Z);

    Min = Colorspace.MIN3(R1, G1, B1);

    /* Force nonnegative values so that gamma correction is well-defined. */
    if (Min < 0) {
        R1 -= Min;
        G1 -= Min;
        B1 -= Min;
    }

    /* Convert value greather than 1 */
    if (R1 > 1 && R1 > G1 && R1 > B1) {
        R1 = 1;
        G1 /= R1;
        B1 /= R1;
    } else if (G1 > 1 && G1 > R1 && G1 > B1) {
        R1 /= G1;
        G1 = 1;
        B1 /= G1;
    } else if (B1 > 1 && B1 > R1 && B1 > G1) {
        R1 /= B1;
        G1 /= B1;
        B1 = 1;
    }

    /* Transform from RGB to R'G'B' */
    R = Colorspace.GAMMACORRECTION(R1);
    G = Colorspace.GAMMACORRECTION(G1);
    B = Colorspace.GAMMACORRECTION(B1);

    return {R, G, B};
};

/**
 * Convert CIE XYZ to CIE L*a*b* (CIELAB) with the D65 white point
 *
 * @param X the input XYZ values
 * @param Y the input XYZ values
 * @param Z the input XYZ values
 *
 * Wikipedia: http://en.wikipedia.org/wiki/Lab_color_space
 */
Colorspace.Xyz2Lab = (X, Y, Z) => {
    let L, A, B;
    X /= Colorspace.WHITEPOINT_X;
    Y /= Colorspace.WHITEPOINT_Y;
    Z /= Colorspace.WHITEPOINT_Z;
    X = Colorspace.LABF(X);
    Y = Colorspace.LABF(Y);
    Z = Colorspace.LABF(Z);
    L = 116 * Y - 16;
    A = 500 * (X - Y);
    B = 200 * (Y - Z);
    return {L, A, B};
};

/**
 * Convert CIE L*a*b* (CIELAB) to CIE XYZ with the D65 white point
 *
 * @param L the input L*a*b* values
 * @param A the input L*a*b* values
 * @param B the input L*a*b* values
 *
 * Wikipedia: http://en.wikipedia.org/wiki/Lab_color_space
 */
Colorspace.Lab2Xyz = (L, A, B) => {
    L = (L + 16) / 116;
    A = L + A / 500;
    B = L - B / 200;
    return {
        X: Colorspace.WHITEPOINT_X * Colorspace.LABINVF(A),
        Y: Colorspace.WHITEPOINT_Y * Colorspace.LABINVF(L),
        Z: Colorspace.WHITEPOINT_Z * Colorspace.LABINVF(B)
    };
};

/**
 * Convert CIE XYZ to CIE L*u*v* (CIELUV) with the D65 white point
 *
 * @param X the input XYZ values
 * @param Y the input XYZ values
 * @param Z the input XYZ values
 *
 * Wikipedia: http://en.wikipedia.org/wiki/CIELUV_color_space
 */
Colorspace.Xyz2Luv = (X, Y, Z) => {
    let L, U, V;
    let u1, v1, Denom;

    if ((Denom = X + 15 * Y + 3 * Z) > 0) {
        u1 = (4 * X) / Denom;
        v1 = (9 * Y) / Denom;
    } else {
        u1 = v1 = 0;
    }

    Y /= Colorspace.WHITEPOINT_Y;
    Y = Colorspace.LABF(Y);
    L = 116 * Y - 16;
    U = 13 * (L) * (u1 - Colorspace.WHITEPOINT_U);
    V = 13 * (L) * (v1 - Colorspace.WHITEPOINT_V);
    return {L, U, V};
};

/**
 * Convert CIE L*u*v* (CIELUV) to CIE XYZ with the D65 white point
 *
 * @param L the input L*u*v* values
 * @param U the input L*u*v* values
 * @param V the input L*u*v* values
 *
 * Wikipedia: http://en.wikipedia.org/wiki/CIELUV_color_space
 */
Colorspace.Luv2Xyz = (L, U, V) => {
    let X, Y, Z;
    Y = (L + 16) / 116;
    Y = Colorspace.WHITEPOINT_Y * Colorspace.LABINVF(Y);

    if (L !== 0) {
        U /= L;
        V /= L;
    }

    U = U / 13 + Colorspace.WHITEPOINT_U;
    V = V / 13 + Colorspace.WHITEPOINT_V;
    X = (Y) * ((9 * U) / (4 * V));
    Z = (Y) * ((3 - 0.75 * U) / V - 5);
    return {X, Y, Z};
};

/**
 * Convert CIE XYZ to CIE L*C*H* with the D65 white point
 *
 * @param X the input XYZ values
 * @param Y the input XYZ values
 * @param Z the input XYZ values
 *
 * CIE L*C*H* is related to CIE L*a*b* by
 *    a* = C* cos(H* pi/180),
 *    b* = C* sin(H* pi/180).
 */
Colorspace.Xyz2Lch = (X, Y, Z) => {
    let L, C, H;
    let C1 = Colorspace.Xyz2Lab(X, Y, Z);
    L = C1.L;
    C = Math.sqrt(C1.A * C1.A + C1.B * C1.B);
    H = Math.atan2(C1.B, C1.A) * 180.0 / Colorspace.M_PI;
    if (H < 0) H += 360;
    return {L, C, H};
};

/**
 * Convert CIE L*C*H* to CIE XYZ with the D65 white point
 *
 * @param L the input L*C*H* values
 * @param C the input L*C*H* values
 * @param H the input L*C*H* values
 */
Colorspace.Lch2Xyz = (L, C, H) => {
    let a = C * Math.cos(H * (Colorspace.M_PI / 180.0));
    let b = C * Math.sin(H * (Colorspace.M_PI / 180.0));
    return Colorspace.Lab2Xyz(L, a, b);
};

/** @brief XYZ to CAT02 LMS */
Colorspace.Xyz2Cat02lms = (X, Y, Z) => {
    return {
        L: (0.7328 * X + 0.4296 * Y - 0.1624 * Z),
        M: (-0.7036 * X + 1.6975 * Y + 0.0061 * Z),
        S: (0.0030 * X + 0.0136 * Y + 0.9834 * Z)
    };
};

/** @brief CAT02 LMS to XYZ */
Colorspace.Cat02lms2Xyz = (L, M, S) => {
    return {
        X: (1.096123820835514 * L - 0.278869000218287 * M + 0.182745179382773 * S),
        Y: (0.454369041975359 * L + 0.473533154307412 * M + 0.072097803717229 * S),
        Z: (-0.009627608738429 * L - 0.005698031216113 * M + 1.015325639954543 * S)
    };
};

/** @brief XYB to XYZ */
Colorspace.Xyb2Xyz = (X, Y, B) => {
    let z = 1 - X - Y;
    return {
        X: (B / Y) * X,
        Y: B,
        Z: (B / Y) * z
    };
};

/** @brief XYZ to XYB */
Colorspace.Xyz2Xyb = (X, Y, Z) => {
    return {
        X: X / (X + Y + Z),
        Y: Y / (X + Y + Z),
        B: Y,
    };
};

/**
 * == Glue functions for multi-stage transforms ==
 */
Colorspace.Rgb2Lab = (R, G, B) => {
    let C1 = Colorspace.Rgb2Xyz(R, G, B);
    return Colorspace.Xyz2Lab(C1.X, C1.Y, C1.Z);
};

Colorspace.Lab2Rgb = (L, A, B) => {
    let C1 = Colorspace.Lab2Xyz(L, A, B);
    return Colorspace.Xyz2Rgb(C1.X, C1.Y, C1.Z);
};

Colorspace.Rgb2Luv = (R, G, B) => {
    let C1 = Colorspace.Rgb2Xyz(R, G, B);
    return Colorspace.Xyz2Luv(C1.X, C1.Y, C1.Z);
};

Colorspace.Luv2Rgb = (L, U, V) => {
    let C1 = Colorspace.Luv2Xyz(L, U, V);
    return Colorspace.Xyz2Rgb(C1.X, C1.Y, C1.Z);
};

Colorspace.Rgb2Lch = (R, G, B) => {
    let C1 = Colorspace.Rgb2Xyz(R, G, B);
    return Colorspace.Xyz2Lch(C1.X, C1.Y, C1.Z);
};

Colorspace.Lch2Rgb = (L, C, H) => {
    let C1 = Colorspace.Lch2Xyz(L, C, H);
    return Colorspace.Xyz2Rgb(C1.X, C1.Y, C1.Z);
};

Colorspace.Rgb2Cat02lms = (R, G, B) => {
    let C1 = Colorspace.Rgb2Xyz(R, G, B);
    return Colorspace.Xyz2Cat02lms(C1.X, C1.Y, C1.Z);
};

Colorspace.Cat02lms2Rgb = (L, M, S) => {
    let C1 = Colorspace.Cat02lms2Xyz(L, M, S);
    return Colorspace.Xyz2Rgb(C1.X, C1.Y, C1.Z);
};

Colorspace.Xyb2Hsv = (X, Y, B) => {
    let C1 = Colorspace.Xyb2Xyz(X, Y, B);
    let C2 = Colorspace.Xyz2Rgb(C1.X, C1.Y, C1.Z);
    return Colorspace.Rgb2Hsv(C2.R, C2.G, C2.B);
};

Colorspace.Hsv2Xyb = (H, S, V) => {
    let C1 = Colorspace.Hsv2Rgb(H, S, V);
    let C2 = Colorspace.Rgb2Xyz(C1.R, C1.G, C1.B);
    return Colorspace.Xyz2Xyb(C2.X, C2.Y, C2.Z);
};

Colorspace.TEMPERATURE_TO_X_TEMPERATURE_TRESHOLD = 4000;

Colorspace.TEMPERATURE_TO_Y_FIRST_TEMPERATURE_TRESHOLD = 2222;
Colorspace.TEMPERATURE_TO_Y_SECOND_TEMPERATURE_TRESHOLD = 4000;

Colorspace.TEMPERATURE_TO_X_FIRST_FACTOR_FIRST_EQUATION = 17440695910400;
Colorspace.TEMPERATURE_TO_X_SECOND_FACTOR_FIRST_EQUATION = 15358885888;
Colorspace.TEMPERATURE_TO_X_THIRD_FACTOR_FIRST_EQUATION = 57520658;
Colorspace.TEMPERATURE_TO_X_FOURTH_FACTOR_FIRST_EQUATION = 11790;

Colorspace.TEMPERATURE_TO_X_FIRST_FACTOR_SECOND_EQUATION = 198301902438400;
Colorspace.TEMPERATURE_TO_X_SECOND_FACTOR_SECOND_EQUATION = 138086835814;
Colorspace.TEMPERATURE_TO_X_THIRD_FACTOR_SECOND_EQUATION = 14590587;
Colorspace.TEMPERATURE_TO_X_FOURTH_FACTOR_SECOND_EQUATION = 15754;

Colorspace.TEMPERATURE_TO_Y_FIRST_FACTOR_FIRST_EQUATION = 18126;
Colorspace.TEMPERATURE_TO_Y_SECOND_FACTOR_FIRST_EQUATION = 22087;
Colorspace.TEMPERATURE_TO_Y_THIRD_FACTOR_FIRST_EQUATION = 35808;
Colorspace.TEMPERATURE_TO_Y_FOURTH_FACTOR_FIRST_EQUATION = 3312;

Colorspace.TEMPERATURE_TO_Y_FIRST_FACTOR_SECOND_EQUATION = 15645;
Colorspace.TEMPERATURE_TO_Y_SECOND_FACTOR_SECOND_EQUATION = 22514;
Colorspace.TEMPERATURE_TO_Y_THIRD_FACTOR_SECOND_EQUATION = 34265;
Colorspace.TEMPERATURE_TO_Y_FOURTH_FACTOR_SECOND_EQUATION = 2744;

Colorspace.TEMPERATURE_TO_Y_FIRST_FACTOR_THIRD_EQUATION = 50491;
Colorspace.TEMPERATURE_TO_Y_SECOND_FACTOR_THIRD_EQUATION = 96229;
Colorspace.TEMPERATURE_TO_Y_THIRD_FACTOR_THIRD_EQUATION = 61458;
Colorspace.TEMPERATURE_TO_Y_FOURTH_FACTOR_THIRD_EQUATION = 6062;

Colorspace.XY_TO_TEMPERATURE_X_EPICENTER = 21757;
Colorspace.XY_TO_TEMPERATURE_Y_EPICENTER = 12176;

/**
 * Converts color temperature to appropriate XY coordinates
 *
 * @param temperature - color temperature (attribute value);
 */
Colorspace.MiredColorTemperatureToXY = (temperature) => {
    if (temperature < 153) temperature = 153;

    let localX, localY;
    let temp = 1000000 / temperature;

    if (Colorspace.TEMPERATURE_TO_X_TEMPERATURE_TRESHOLD > temp)
        localX = Colorspace.TEMPERATURE_TO_X_THIRD_FACTOR_FIRST_EQUATION / temp +
            Colorspace.TEMPERATURE_TO_X_FOURTH_FACTOR_FIRST_EQUATION -
            Colorspace.TEMPERATURE_TO_X_SECOND_FACTOR_FIRST_EQUATION / temp / temp -
            Colorspace.TEMPERATURE_TO_X_FIRST_FACTOR_FIRST_EQUATION / temp / temp / temp;
    else
        localX = Colorspace.TEMPERATURE_TO_X_SECOND_FACTOR_SECOND_EQUATION / temp / temp +
            Colorspace.TEMPERATURE_TO_X_THIRD_FACTOR_SECOND_EQUATION / temp +
            Colorspace.TEMPERATURE_TO_X_FOURTH_FACTOR_SECOND_EQUATION -
            Colorspace.TEMPERATURE_TO_X_FIRST_FACTOR_SECOND_EQUATION / temp / temp / temp;

    if (Colorspace.TEMPERATURE_TO_Y_FIRST_TEMPERATURE_TRESHOLD > temp)
        localY = Colorspace.TEMPERATURE_TO_Y_THIRD_FACTOR_FIRST_EQUATION * localX / 65536 -
            Colorspace.TEMPERATURE_TO_Y_FIRST_FACTOR_FIRST_EQUATION * localX * localX * localX / 281474976710656 -
            Colorspace.TEMPERATURE_TO_Y_SECOND_FACTOR_FIRST_EQUATION * localX * localX / 4294967296 -
            Colorspace.TEMPERATURE_TO_Y_FOURTH_FACTOR_FIRST_EQUATION;
    else if (Colorspace.TEMPERATURE_TO_Y_SECOND_TEMPERATURE_TRESHOLD > temp)
        localY = Colorspace.TEMPERATURE_TO_Y_THIRD_FACTOR_SECOND_EQUATION * localX / 65536 -
            Colorspace.TEMPERATURE_TO_Y_FIRST_FACTOR_SECOND_EQUATION * localX * localX * localX / 281474976710656 -
            Colorspace.TEMPERATURE_TO_Y_SECOND_FACTOR_SECOND_EQUATION * localX * localX / 4294967296 -
            Colorspace.TEMPERATURE_TO_Y_FOURTH_FACTOR_SECOND_EQUATION;
    else {
        localY = Colorspace.TEMPERATURE_TO_Y_THIRD_FACTOR_THIRD_EQUATION * localX / 65536 +
            Colorspace.TEMPERATURE_TO_Y_FIRST_FACTOR_THIRD_EQUATION * localX * localX * localX / 281474976710656 -
            Colorspace.TEMPERATURE_TO_Y_SECOND_FACTOR_THIRD_EQUATION * localX * localX / 4294967296 -
            Colorspace.TEMPERATURE_TO_Y_FOURTH_FACTOR_THIRD_EQUATION;
    }

    localY *= 4;

    return {
        X: localX,
        Y: localY
    };
};

module.exports = Colorspace;
