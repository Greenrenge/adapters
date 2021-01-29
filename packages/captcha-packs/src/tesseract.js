import Tesseract from 'tesseract.js'
import sharp from 'sharp'

export const resize = (file, scale = 200) =>
  sharp(file)
    .resize(scale)
    .toBuffer()

export const captcha = async (file, needResize = true) => {
  if (needResize) {
    const buffer = await resize(file)
    return Tesseract.recognize(buffer)
  }
  return Tesseract.recognize(file)
}
