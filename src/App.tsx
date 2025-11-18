import React, { useState, useRef, useEffect } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Workbook } from "exceljs";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { type DragEndEvent } from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import bannerMobile from "./arquivos/bannermobile.png";
import bannerDesk from "./arquivos/bannerdesk.png";
import logoGif from "./arquivos/tennislogo.gif";

type ImageType = {
  id: string;
  url: string;
};

const LOCAL_STORAGE_KEY = "savedImages";
// CANTIDAD DE IMÁGENES POR PDF (Lo pediste de 3 en 3)
const IMAGES_PER_PDF = 3;

// --- Iconos SVG inline ---
const SearchIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);
const LocationIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
    <circle cx="12" cy="10" r="3"></circle>
  </svg>
);
const BookmarkIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
  </svg>
);
const CartIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="9" cy="21" r="1"></circle>
    <circle cx="20" cy="21" r="1"></circle>
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
  </svg>
);

function SortableImage({
  image,
  onDelete,
}: {
  image: ImageType;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : "auto",
    opacity: isDragging ? 0.8 : 1,
    touchAction: "none",
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete(image.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="sortable-image-container"
    >
      <div className="image-wrapper">
        <img
          src={image.url}
          alt={`foto-subida-${image.id}`}
          className="grid-image"
        />
      </div>
      <div className="product-info">
        <p className="product-title">Imagen de prueba</p>
        <div className="product-pricing">
          <span className="discount-badge">30%</span>
          <span className="price-current">$ 00.000</span>
          <span className="price-old">$ 00.000</span>
        </div>
      </div>
      <button className="delete-image-btn" onClick={handleDeleteClick}>
        Eliminar Imagen
      </button>
    </div>
  );
}

function App() {
  const [images, setImages] = useState<ImageType[]>(() => {
    try {
      const savedImages = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedImages) return JSON.parse(savedImages) as ImageType[];
    } catch (e) {
      console.error("Error localstorage", e);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
    return [];
  });

  const [isExporting, setIsExporting] = useState(false);
  // Estado para mostrar progreso (Ej: "Generando PDF 1 de 10...")
  const [exportProgress, setExportProgress] = useState("");
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } })
  );

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(images));
    } catch (e) {
      alert("Error: Almacenamiento lleno.");
    }
  }, [images]);

  const handleUploadClick = () => fileInputRef.current?.click();
  const handleFolderUploadClick = () => folderInputRef.current?.click();

  const handleImportJSON = () => {
    const jsonInput = prompt("Pega aquí el JSON generado:");
    if (jsonInput) {
      try {
        const parsedImages = JSON.parse(jsonInput);
        if (Array.isArray(parsedImages)) {
          const validImages = parsedImages.filter((img) => img.id && img.url);
          setImages((prev) => [...prev, ...validImages]);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    const readFileAsDataURL = (file: File): Promise<ImageType | null> => {
      return new Promise((resolve, reject) => {
        if (!file.type.startsWith("image/")) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = () =>
          resolve({ id: crypto.randomUUID(), url: reader.result as string });
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });
    };
    const newImagePromises = Array.from(files).map(readFileAsDataURL);
    Promise.all(newImagePromises).then((newImages) => {
      const validNewImages = newImages.filter(
        (img) => img !== null
      ) as ImageType[];
      setImages((prev) => [...prev, ...validNewImages]);
    });
    event.target.value = "";
  };

  const handleDeleteSession = () => {
    if (window.confirm("¿Estás seguro de eliminar TODAS las imágenes?")) {
      setImages([]);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  };

  const requestDeleteImage = (id: string) => setImageToDelete(id);
  const handleConfirmDelete = () => {
    if (imageToDelete) {
      setImages((prev) => prev.filter((img) => img.id !== imageToDelete));
      setImageToDelete(null);
    }
  };
  const handleCancelDelete = () => setImageToDelete(null);

  // --- LOGICA DE EXPORTACIÓN POR LOTES (BATCHES) ---
  const handleExportPDF = async () => {
    setIsExporting(true);

    const rootElement = document.getElementById("root") as HTMLElement;
    const controls = document.querySelector(".controls") as HTMLElement;
    const deleteBtn = document.querySelector(
      ".delete-session-container"
    ) as HTMLElement;

    // 1. Ocultar elementos que no queremos en el PDF
    if (controls) controls.style.display = "none";
    if (deleteBtn) deleteBtn.style.display = "none";
    const deleteImgBtns = document.querySelectorAll(
      ".delete-image-btn"
    ) as NodeListOf<HTMLElement>;
    deleteImgBtns.forEach((btn) => (btn.style.display = "none"));

    // 2. Obtener todas las tarjetas de imágenes del DOM
    const allImageContainers = Array.from(
      document.querySelectorAll(".sortable-image-container")
    ) as HTMLElement[];

    // 3. Calcular cuántos PDFs haremos
    const totalBatches = Math.ceil(allImageContainers.length / IMAGES_PER_PDF);

    try {
      for (let i = 0; i < totalBatches; i++) {
        setExportProgress(`Generando PDF ${i + 1} de ${totalBatches}...`);

        // 4. Calcular índices de inicio y fin para este lote
        const start = i * IMAGES_PER_PDF;
        const end = start + IMAGES_PER_PDF;

        // 5. Mostrar SOLO las imágenes de este lote, ocultar las demás
        allImageContainers.forEach((container, index) => {
          // Guardar el display original si lo necesitaras, pero flex está bien
          if (index >= start && index < end) {
            container.style.display = "flex";
          } else {
            container.style.display = "none";
          }
        });

        // 6. Pequeña pausa para que el navegador renderice los cambios (reflow)
        await new Promise((resolve) => setTimeout(resolve, 100));

        // 7. Capturar el PDF
        const canvas = await html2canvas(rootElement, {
          useCORS: true,
          scale: 2,
          scrollY: -window.scrollY,
          windowWidth: document.documentElement.offsetWidth,
        });

        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const ratio = canvasHeight / canvasWidth;
        const imgHeight = pdfWidth * ratio;

        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight);
          heightLeft -= pdfHeight;
        }

        // 8. Descargar este archivo específico
        pdf.save(`catalogo_parte_${i + 1}.pdf`);

        // 9. Pausa de seguridad para no saturar la memoria del navegador
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error("Error exportando PDF", error);
      alert("Hubo un error generando los PDFs.");
    } finally {
      // 10. Restaurar todo a la normalidad
      allImageContainers.forEach(
        (container) => (container.style.display = "flex")
      );
      if (controls) controls.style.display = "flex";
      if (deleteBtn) deleteBtn.style.display = "flex";
      deleteImgBtns.forEach((btn) => (btn.style.display = ""));

      setIsExporting(false);
      setExportProgress("");
    }
  };

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet("Imagenes");
      worksheet.getColumn("A").width = 40;
      const ROW_HEIGHT_POINTS = 150;

      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        let base64Data = "";
        let extension: "png" | "jpeg" = "png";

        if (image.url.startsWith("data:image")) {
          base64Data = image.url.split(",")[1];
          const imageType = image.url.match(/data:image\/(.+);/)?.[1] || "png";
          extension = imageType === "jpeg" ? "jpeg" : "png";
        } else {
          try {
            const response = await fetch(image.url);
            const blob = await response.blob();
            const reader = new FileReader();
            base64Data = await new Promise((resolve) => {
              reader.onloadend = () =>
                resolve((reader.result as string).split(",")[1]);
              reader.readAsDataURL(blob);
            });
          } catch (e) {
            continue;
          }
        }
        const imageId = workbook.addImage({
          base64: base64Data,
          extension: extension,
        });
        const row = worksheet.getRow(i + 1);
        row.height = ROW_HEIGHT_POINTS;
        worksheet.addImage(imageId, {
          tl: { col: 0, row: i },
          ext: { width: 280, height: 200 },
        });
      }
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "imagenes.xlsx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error(err);
      alert("Error al crear Excel.");
    }
    setIsExportingExcel(false);
  };

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setImages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  return (
    <>
      {/* OVERLAY DE PROGRESO (Se muestra solo cuando se exporta) */}
      {isExporting && (
        <div className="export-overlay">
          <div className="export-message">
            <div className="spinner"></div>
            <p>{exportProgress}</p>
            <small>
              Por favor, permite la descarga de múltiples archivos si el
              navegador lo pregunta.
            </small>
          </div>
        </div>
      )}

      <div className="top-bar">
        <span className="top-bar-left">
          NUEVA COLECCIÓN PARA HOMBRE VER AHORA
        </span>
        <span className="top-bar-center">
          ¡BLACK DAYS! 30%OFF EN TODA LA TIENDA + OFERTAS EXCLUSIVAS ONLINE
        </span>
        <div className="top-bar-right">
          <span>Ayuda</span>
          <span className="separator">|</span>
          <span>INICIAR SESIÓN</span>
        </div>
      </div>

      <header className="main-header">
        <div className="header-content">
          <div className="header-left">
            <img src={logoGif} alt="Logo" className="logo" />
            <nav className="nav-menu">
              <a href="#">Nuevo</a>
              <a href="#">Mujer</a>
              <a href="#">Hombre</a>
              <a href="#">Kids</a>
              <a href="#">Básicos</a>
              <a href="#">Topmark</a>
              <a href="#">Black days</a>
              <a href="#">Blog</a>
            </nav>
          </div>
          <div className="header-actions">
            <div className="search-container">
              <input
                type="text"
                placeholder="Buscar"
                className="search-input"
              />
              <button className="icon-btn">
                <SearchIcon />
              </button>
            </div>
            <button className="icon-btn">
              <LocationIcon />
            </button>
            <button className="icon-btn">
              <BookmarkIcon />
            </button>
            <button className="icon-btn cart-btn">
              <CartIcon />
              <span className="cart-badge">1</span>
            </button>
          </div>
        </div>
      </header>

      <main>
        <picture className="banner">
          <source srcSet={bannerMobile} media="(max-width: 767px)" />
          <source srcSet={bannerDesk} media="(min-width: 768px)" />
          <img src={bannerDesk} alt="Banner principal" className="banner-img" />
        </picture>

        <h1 className="main-title">Ropa para hombre</h1>

        <div className="controls">
          <button className="btn-v" onClick={handleUploadClick}>
            <span className="btn-v_lg">
              <span className="btn-v_sl"></span>
              <span className="btn-v_text">Subir fotos</span>
            </span>
          </button>
          <button className="btn-v" onClick={handleFolderUploadClick}>
            <span className="btn-v_lg">
              <span className="btn-v_sl"></span>
              <span className="btn-v_text">Subir Carpeta</span>
            </span>
          </button>
          <button className="btn-v" onClick={handleImportJSON}>
            <span
              className="btn-v_lg"
              style={{ background: "#0f1923", color: "#fff" }}
            >
              <span
                className="btn-v_sl"
                style={{ background: "#ff4655" }}
              ></span>
              <span className="btn-v_text">Importar JSON</span>
            </span>
          </button>

          <button
            className="btn-uiverse-dl"
            type="button"
            onClick={handleExportPDF}
            disabled={isExporting}
          >
            <span className="btn-uiverse-dl__text">
              {isExporting ? "Procesando..." : "Exportar PDF"}
            </span>
            <span className="btn-uiverse-dl__icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 35 35"
                className="svg"
              >
                <path d="M17.5,22.131a1.249,1.249,0,0,1-1.25-1.25V2.187a1.25,1.25,0,0,1,2.5,0V20.881A1.25,1.25,0,0,1,17.5,22.131Z"></path>
                <path d="M17.5,22.693a3.189,3.189,0,0,1-2.262-.936L8.487,15.006a1.249,1.249,0,0,1,1.767-1.767l6.751,6.751a.7.7,0,0,0,.99,0l6.751-6.751a1.25,1.25,0,0,1,1.768,1.767l-6.752,6.751A3.191,3.191,0,0,1,17.5,22.693Z"></path>
                <path d="M31.436,34.063H3.564A3.318,3.318,0,0,1,.25,30.749V22.011a1.25,1.25,0,0,1,2.5,0v8.738a.815.815,0,0,0,.814.814H31.436a.815.815,0,0,0,.814-.814V22.011a1.25,1.25,0,1,1,2.5,0v8.738A3.318,3.318,0,0,1,31.436,34.063Z"></path>
              </svg>
            </span>
          </button>

          <button
            className="btn-uiverse-dl"
            type="button"
            onClick={handleExportExcel}
            disabled={isExportingExcel}
          >
            <span className="btn-uiverse-dl__text">
              {isExportingExcel ? "Generando..." : "Descargar Excel"}
            </span>
            <span className="btn-uiverse-dl__icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 35 35"
                className="svg"
              >
                <path d="M17.5,22.131a1.249,1.249,0,0,1-1.25-1.25V2.187a1.25,1.25,0,0,1,2.5,0V20.881A1.25,1.25,0,0,1,17.5,22.131Z"></path>
                <path d="M17.5,22.693a3.189,3.189,0,0,1-2.262-.936L8.487,15.006a1.249,1.249,0,0,1,1.767-1.767l6.751,6.751a.7.7,0,0,0,.99,0l6.751-6.751a1.25,1.25,0,0,1,1.768,1.767l-6.752,6.751A3.191,3.191,0,0,1,17.5,22.693Z"></path>
                <path d="M31.436,34.063H3.564A3.318,3.318,0,0,1,.25,30.749V22.011a1.25,1.25,0,0,1,2.5,0v8.738a.815.815,0,0,0,.814.814H31.436a.815.815,0,0,0,.814-.814V22.011a1.25,1.25,0,1,1,2.5,0v8.738A3.318,3.318,0,0,1,31.436,34.063Z"></path>
              </svg>
            </span>
          </button>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          accept="image/*"
          style={{ display: "none" }}
        />
        <input
          type="file"
          ref={folderInputRef}
          onChange={handleFileChange}
          multiple
          accept="image/*"
          {...({ webkitdirectory: "" } as any)}
          style={{ display: "none" }}
        />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToWindowEdges]}
        >
          <SortableContext items={images} strategy={rectSortingStrategy}>
            <div className="image-grid">
              {images.map((image) => (
                <SortableImage
                  key={image.id}
                  image={image}
                  onDelete={requestDeleteImage}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {images.length > 0 && (
          <div className="delete-session-container">
            <button className="noselect" onClick={handleDeleteSession}>
              <span className="text">Delete</span>
              <span className="icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                >
                  <path d="M24 20.188l-8.315-8.209 8.2-8.282-3.697-3.697-8.212 8.318-8.31-8.203-3.666 3.666 8.321 8.24-8.206 8.313 3.666 3.666 8.237-8.318 8.285 8.203z"></path>
                </svg>
              </span>
            </button>
          </div>
        )}
      </main>

      {imageToDelete && (
        <div className="modal-overlay">
          <div className="modal-content">
            <p>¿Estás seguro de eliminar la imagen?</p>
            <div className="modal-buttons">
              <button
                className="modal-btn modal-btn-confirm"
                onClick={handleConfirmDelete}
              >
                Sí
              </button>
              <button
                className="modal-btn modal-btn-cancel"
                onClick={handleCancelDelete}
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
