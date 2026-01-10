// Utility to extract ID3 tags including album art
// Relies on jsmediatags being loaded globally via script tag

export interface AudioMetadata {
  title?: string;
  artist?: string;
  picture?: string; // Blob URL
}

export const getMetadata = (file: File): Promise<AudioMetadata> => {
  return new Promise((resolve) => {
    // @ts-ignore
    if (!window.jsmediatags) {
      console.warn("jsmediatags library not loaded");
      resolve({});
      return;
    }

    // @ts-ignore
    window.jsmediatags.read(file, {
      onSuccess: (tag: any) => {
        const { title, artist, picture } = tag.tags;
        let pictureUrl = undefined;

        if (picture) {
          const { data, format } = picture;
          let base64String = "";
          for (let i = 0; i < data.length; i++) {
            base64String += String.fromCharCode(data[i]);
          }
          pictureUrl = `data:${format};base64,${window.btoa(base64String)}`;
        }

        resolve({
          title,
          artist,
          picture: pictureUrl,
        });
      },
      onError: (error: any) => {
        console.warn("Error reading tags:", error);
        resolve({});
      },
    });
  });
};