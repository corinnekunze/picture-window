import * as tf from "@tensorflow/tfjs";
import * as nsfw from "nsfwjs";
import sharp from "sharp";

let model: nsfw.NSFWJS | undefined;

/**
 * Probability that an image is nude or sexual (nsfwjs Porn + Hentai + Sexy), 0–1.
 * The model's "Drawing" class is ignored: it misreads real photos of industrial scenes.
 */
export async function nsfwScore(image: Buffer): Promise<number> {
  if (!model) {
    await tf.setBackend("cpu");
    model = await nsfw.load("MobileNetV2");
  }
  const { data, info } = await sharp(image).resize(224, 224, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], "int32");
  try {
    const predictions: { className: string; probability: number }[] = await model.classify(tensor as tf.Tensor3D);
    return predictions
      .filter((p) => p.className === "Porn" || p.className === "Hentai" || p.className === "Sexy")
      .reduce((sum, p) => sum + p.probability, 0);
  } finally {
    tensor.dispose();
  }
}
