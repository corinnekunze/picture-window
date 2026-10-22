import * as tf from "@tensorflow/tfjs";
import * as nsfw from "nsfwjs";
import sharp from "sharp";

const MODEL_INPUT_SIZE = 224;
/** The classes that mean nude or sexual. "Drawing" is ignored: it misreads photos of industrial scenes. */
const UNSAFE_CLASSES = new Set(["Porn", "Hentai", "Sexy"]);

interface Prediction {
  className: string;
  probability: number;
}

let model: nsfw.NSFWJS | undefined;

async function loadModel(): Promise<nsfw.NSFWJS> {
  if (model) return model;
  await tf.setBackend("cpu");
  model = await nsfw.load("MobileNetV2");
  return model;
}

/** Probability, 0–1, that an image is nude or sexual. */
export async function nsfwScore(image: Buffer): Promise<number> {
  const classifier = await loadModel();
  const { data, info } = await sharp(image)
    .resize(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], "int32");

  try {
    const predictions: Prediction[] = await classifier.classify(tensor as tf.Tensor3D);
    return predictions
      .filter((prediction) => UNSAFE_CLASSES.has(prediction.className))
      .reduce((total, prediction) => total + prediction.probability, 0);
  } finally {
    tensor.dispose();
  }
}
