# h5-image-explorer
Preview image sets from a lookup table extracted from a dataset made up of sharded HDF5 files.

## Purpose
This was written to get a convenient glimpse at the contents of an image dataset formatted into HDF5 shards.
Our use case is to be able to peek into the TreeOfLife dataset based on a filtered lookup table. 

## Running
On the system where your HDF5 image dataset resides:
- Clone this repository.
- Set up an environment and install dependencies in `requirements.txt`.
- Run `python app.py`.

The lookup file (Parquet or CSV) needs to have columns labelled:
- `"uuid"`
- `"filepath"`

For example:
```
uuid,filepath
00053a2e-2d75-4be5-a05c-4a8c9438c759,/path/to/data_0c03e0e5-17d1-44aa-9f1a-fed7ec7d60a9
002b0fee-4fe2-4efa-b91b-961ef24c71a8,/path/to/data_0c03e0e5-17d1-44aa-9f1a-fed7ec7d60a9
```

Here, `filepath` points to a `/path/to/<filename-prefix>`.
For each such `filepath`, the viewer expects:
- `<filename-prefix>_images.h5`
- `<filename-prefix>_metadata.parquet`

The HDF5 images file contains UUID keyed images. The encoded image format should be flexible to accommodate browser-supported formats.
In the images HDF5 file, there must be an `images` group with each dataset (i.e. image) keyed by a UUID.

The metadata Parquet file is required to have a `"uuid"` column to match keys to the image, and the app will display arbitrary metadata associated with that entry.

## Usage
The app consists of three panels after a lookup table is loaded:
- Dataset Contents
- Image Viewer
- Metadata

The Dataset Contents displays brief summary statistics from the lookup, including the total number of records and the number of unique filepaths it indexes. The vertical slider enables quick navigation along the entire index. Clicking on one of the entries retrieves it from the indexed file and displays the associated image in the Image Viewer panel. It also reports the time taken to retrieve the image as well as the indexed file from which it was retrieved. The Metadata panel displays the associated metadata for that image.

<img width="1267" height="915" alt="image" src="https://github.com/user-attachments/assets/406f5939-2139-473e-84fd-859c287285b8" />

