"use client";

import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { KTX2_TRANSCODER_PATH } from "@/data/assets";

export function useKtx2Loader() {
  const { gl } = useThree();

  const loader = useMemo(() => {
    const next = new KTX2Loader();
    next.setTranscoderPath(KTX2_TRANSCODER_PATH);
    next.detectSupport(gl);
    return next;
  }, [gl]);

  useEffect(() => () => loader.dispose(), [loader]);

  return loader;
}
