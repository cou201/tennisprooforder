import React, { useState, useRef, useEffect, useCallback } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Workbook } from "exceljs";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay, // Nuevo import
  useDraggable, // Nuevo import
  type UniqueIdentifier, // Nuevo import
  type DragStartEvent, // Nuevo import
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
  name?: string;
};

const LOCAL_STORAGE_KEY = "savedImages";
const ITEMS_PER_PDF_FILE = 48;

// --- ICONOS SVG ---
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

// --- COMPONENTE SortableImage CON CHECKBOX ---
function SortableImage({
  image,
  onDelete,
  isSelected,
  onToggleSelect,
  isDraggingItem,
}: {
  image: ImageType;
  onDelete: (id: string) => void;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  isDraggingItem: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id });

  const style: React.CSSProperties = {
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

  // Manejador del Checkbox
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation(); // Evita activar el drag al hacer clic
    onToggleSelect(image.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`sortable-image-container ${
        isSelected ? "selected-image" : ""
      } ${isDraggingItem ? "dragging-active-item" : ""}`}
    >
      {/* CHECKBOX AÑADIDO */}
      <div className="checkbox-container">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleCheckboxChange}
          // onPointerDown evita que dnd-kit capture el evento en el input
          onPointerDown={(e) => e.stopPropagation()}
          className="image-checkbox"
          data-html2canvas-ignore="true"
        />
      </div>

      <div className="image-wrapper">
        <img
          src={image.url}
          alt={`foto-subida-${image.id}`}
          className="grid-image"
        />
      </div>
      <div className="product-info">
        <p className="product-title">{image.name || "Imagen de prueba"}</p>
        <div className="product-pricing"></div>
      </div>
      <button
        className="delete-image-btn"
        onClick={handleDeleteClick}
        data-html2canvas-ignore="true"
      >
        Eliminar Imagen
      </button>
    </div>
  );
}

// --- PREVIEW FLOTANTE PARA ARRASTRE MÚLTIPLE ---
function DraggableMultipleImages({
  images,
  activeId,
  selectedImages,
}: {
  images: ImageType[];
  activeId: UniqueIdentifier | null;
  selectedImages: UniqueIdentifier[];
}) {
  const itemsToShow =
    selectedImages.length > 0
      ? images.filter((img) => selectedImages.includes(img.id))
      : activeId
      ? [images.find((img) => img.id === activeId)!]
      : [];

  if (itemsToShow.length === 0) return null;
  if (
    itemsToShow.length === 1 &&
    itemsToShow[0].id === activeId &&
    selectedImages.length <= 1
  )
    return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "10px",
        background: "rgba(255,255,255,0.9)",
        border: "2px solid #e62222",
        borderRadius: "8px",
        boxShadow: "0 10px 20px rgba(0,0,0,0.3)",
        width: "180px",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontWeight: "bold",
          marginBottom: "5px",
          textAlign: "center",
          color: "#000",
        }}
      >
        Moviendo {itemsToShow.length} ítems
      </div>
      <div
        style={{
          display: "flex",
          gap: "5px",
          overflow: "hidden",
          height: "60px",
        }}
      >
        {itemsToShow.slice(0, 3).map((img) => (
          <img
            key={img.id}
            src={img.url}
            style={{
              width: "50px",
              height: "50px",
              objectFit: "cover",
              borderRadius: "4px",
            }}
          />
        ))}
      </div>
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
  const [exportProgress, setExportProgress] = useState("");
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<string | null>(null);

  // --- ESTADO PARA SELECCIÓN ---
  const [selectedImageIds, setSelectedImageIds] = useState<UniqueIdentifier[]>(
    []
  );
  const [activeDragId, setActiveDragId] = useState<UniqueIdentifier | null>(
    null
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } })
  );

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(images));
    } catch (e) {
      console.warn(
        "El almacenamiento local está lleno. Los cambios no persistirán si recargas la página."
      );
    }
  }, [images]);

  // --- LOGICA DE SELECCION ---
  const handleToggleSelect = useCallback((id: UniqueIdentifier) => {
    setSelectedImageIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((selectedId) => selectedId !== id);
      } else {
        return [...prev, id];
      }
    });
  }, []);

  const handleSelectAll = () => {
    if (selectedImageIds.length === images.length) {
      setSelectedImageIds([]);
    } else {
      setSelectedImageIds(images.map((img) => img.id));
    }
  };

  const handleClearSelection = () => setSelectedImageIds([]);

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
          resolve({
            id: crypto.randomUUID(),
            url: reader.result as string,
            name: file.name,
          });
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

  const handleFolderRecursiveUpload = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files) return;
    const imagesByFolder: Record<string, File[]> = {};
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const fullPath = file.webkitRelativePath;
      const pathParts = fullPath.split("/");
      pathParts.pop();
      const folderPath = pathParts.join("/");
      if (!imagesByFolder[folderPath]) imagesByFolder[folderPath] = [];
      imagesByFolder[folderPath].push(file);
    });
    const selectedFiles: File[] = [];
    Object.keys(imagesByFolder).forEach((folder) => {
      const folderFiles = imagesByFolder[folder];
      folderFiles.sort((a, b) => a.name.localeCompare(b.name));
      if (folderFiles.length > 0) selectedFiles.push(folderFiles[0]);
    });
    const readFileAsDataURL = (file: File): Promise<ImageType | null> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve({
            id: crypto.randomUUID(),
            url: reader.result as string,
            name: file.name,
          });
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });
    };
    const newImagePromises = selectedFiles.map(readFileAsDataURL);
    Promise.all(newImagePromises).then((newImages) => {
      const validNewImages = newImages.filter(
        (img) => img !== null
      ) as ImageType[];
      setImages((prev) => [...prev, ...validNewImages]);
      alert(
        `Se procesaron ${
          Object.keys(imagesByFolder).length
        } carpetas y se cargaron ${validNewImages.length} imágenes.`
      );
    });
    event.target.value = "";
  };

  const handleDeleteSession = () => {
    if (window.confirm("¿Estás seguro de eliminar TODAS las imágenes?")) {
      setImages([]);
      setSelectedImageIds([]);
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  };

  const requestDeleteImage = (id: string) => setImageToDelete(id);
  const handleConfirmDelete = () => {
    if (imageToDelete) {
      setImages((prev) => prev.filter((img) => img.id !== imageToDelete));
      setSelectedImageIds((prev) => prev.filter((id) => id !== imageToDelete));
      setImageToDelete(null);
    }
  };
  const handleCancelDelete = () => setImageToDelete(null);

  const handleExportPDF = async () => {
    setIsExporting(true);
    const rootElement = document.getElementById("root") as HTMLElement;
    const controls = document.querySelector(".controls") as HTMLElement;
    const deleteBtn = document.querySelector(
      ".delete-session-container"
    ) as HTMLElement;
    const deleteImgBtns = document.querySelectorAll(
      ".delete-image-btn"
    ) as NodeListOf<HTMLElement>;

    if (controls) controls.style.display = "none";
    if (deleteBtn) deleteBtn.style.display = "none";
    deleteImgBtns.forEach((btn) => (btn.style.display = "none"));

    // Ocultar checkboxes temporalmente
    const checkboxes = document.querySelectorAll(
      ".checkbox-container"
    ) as NodeListOf<HTMLElement>;
    checkboxes.forEach((box) => (box.style.display = "none"));

    const allImageContainers = Array.from(
      document.querySelectorAll(".sortable-image-container")
    ) as HTMLElement[];
    const totalFilesNeeded = Math.ceil(
      allImageContainers.length / ITEMS_PER_PDF_FILE
    );

    try {
      for (let i = 0; i < totalFilesNeeded; i++) {
        setExportProgress(
          `Generando Archivo ${i + 1} de ${totalFilesNeeded}...`
        );
        const start = i * ITEMS_PER_PDF_FILE;
        const end = start + ITEMS_PER_PDF_FILE;
        allImageContainers.forEach((container, index) => {
          if (index >= start && index < end) {
            container.style.display = "flex";
          } else {
            container.style.display = "none";
          }
        });
        await new Promise((resolve) => setTimeout(resolve, 200));
        const canvas = await html2canvas(rootElement, {
          useCORS: true,
          scale: 2,
          scrollY: -window.scrollY,
          windowWidth: document.documentElement.offsetWidth,
          ignoreElements: (element) =>
            element.hasAttribute("data-html2canvas-ignore"),
          backgroundColor: "#ffffff",
        });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgHeight = pdfWidth * (canvas.height / canvas.width);
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
        pdf.save(`catalogo_parte_${i + 1}.pdf`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error("Error exportando PDF", error);
      alert("Hubo un error generando los PDFs.");
    } finally {
      allImageContainers.forEach(
        (container) => (container.style.display = "flex")
      );
      if (controls) controls.style.display = "flex";
      if (deleteBtn) deleteBtn.style.display = "flex";
      deleteImgBtns.forEach((btn) => (btn.style.display = ""));
      checkboxes.forEach((box) => (box.style.display = "flex")); // Mostrar checkboxes
      setIsExporting(false);
      setExportProgress("");
    }
  };

  const handleExportExcel = async () => {
    setIsExportingExcel(true);
    try {
      const workbook = new Workbook();
      const worksheet = workbook.addWorksheet("Listado de Imagenes");
      worksheet.getColumn("A").width = 60;
      const headerRow = worksheet.getRow(1);
      headerRow.getCell(1).value = "NOMBRE DEL ARCHIVO";
      headerRow.font = { bold: true };
      headerRow.commit();
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const row = worksheet.getRow(i + 2);
        row.getCell(1).value = image.name || `Imagen sin nombre (${image.id})`;
      }
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "listado_imagenes.xlsx";
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

  // --- LOGICA DE ARRASTRE ---
  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    setActiveDragId(active.id);
    // Si arrastramos algo que NO está seleccionado, lo seleccionamos automáticamente (y deseleccionamos el resto si no usas Shift/Ctrl)
    // En este caso simplificado: Si no está seleccionado, lo añadimos a la selección solo para el drag visual.
    if (!selectedImageIds.includes(active.id)) {
      setSelectedImageIds([active.id]);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragId(null);

    if (over && active.id !== over.id) {
      setImages((currentImages) => {
        const activeIndex = currentImages.findIndex(
          (item) => item.id === active.id
        );
        const overIndex = currentImages.findIndex(
          (item) => item.id === over.id
        );

        // Si estamos moviendo un grupo seleccionado
        if (
          selectedImageIds.length > 1 &&
          selectedImageIds.includes(active.id)
        ) {
          const itemsToMove = currentImages.filter((img) =>
            selectedImageIds.includes(img.id)
          );
          const itemsRemaining = currentImages.filter(
            (img) => !selectedImageIds.includes(img.id)
          );

          // Calculamos dónde insertar.
          // Encontramos el item sobre el que soltamos en la lista de remanentes (si existe ahí)
          let insertIndex = itemsRemaining.findIndex(
            (item) => item.id === over.id
          );

          // Si soltamos sobre uno de los ítems seleccionados (que visualmente se mueven con nosotros),
          // intentamos mantener la posición lógica relativa al original start.
          // Pero para simplificar: si no se encuentra en remaining (porque soltamos sobre uno seleccionado), usamos overIndex ajustado.
          if (insertIndex === -1) {
            // Lógica fallback segura: arrayMove simple del activo si algo falla en lógica de grupo
            return arrayMove(currentImages, activeIndex, overIndex);
          }

          // Ajuste visual: Si arrastramos hacia abajo, insertamos después.
          // Esto es complejo calcular perfecto sin refs, pero insertaremos en la posición encontrada.
          const newOrder = [...itemsRemaining];

          // Si el target (over) estaba originalmente después del source (active), insertamos después
          // (Esta es una aproximación, dnd-kit maneja índices, aquí reconstruimos el array)
          if (activeIndex < overIndex) {
            newOrder.splice(insertIndex + 1, 0, ...itemsToMove);
          } else {
            newOrder.splice(insertIndex, 0, ...itemsToMove);
          }

          return newOrder;
        }

        // Movimiento simple de 1 elemento
        return arrayMove(currentImages, activeIndex, overIndex);
      });
    }
  }

  return (
    <>
      {isExporting && (
        <div className="export-overlay" data-html2canvas-ignore="true">
          <div className="export-message">
            <div className="spinner"></div>
            <p>{exportProgress}</p>
            <small>Por favor, permite la descarga de múltiples archivos.</small>
          </div>
        </div>
      )}

      <div className="top-bar">
        <span className="top-bar-left">
          NUEVA COLECCIÓN PARA HOMBRE VER AHORA
        </span>
        <span className="top-bar-center">
          ¡BLACK DAYS! 30%OFF EN TODA LA TIENDA
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
            onChange={handleFolderRecursiveUpload}
            multiple
            accept="image/*"
            {...({ webkitdirectory: "" } as any)}
            style={{ display: "none" }}
          />

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

          {/* BOTONES DE SELECCIÓN */}
          {images.length > 0 && (
            <button className="btn-v" onClick={handleSelectAll}>
              <span
                className="btn-v_lg"
                style={{ background: "#007bff", color: "#fff" }}
              >
                <span
                  className="btn-v_sl"
                  style={{ background: "#0056b3" }}
                ></span>
                <span className="btn-v_text">
                  {selectedImageIds.length === images.length
                    ? "Deseleccionar"
                    : "Seleccionar Todo"}
                </span>
              </span>
            </button>
          )}
          {selectedImageIds.length > 0 && (
            <button className="btn-v" onClick={handleClearSelection}>
              <span
                className="btn-v_lg"
                style={{ background: "#ffc107", color: "#000" }}
              >
                <span
                  className="btn-v_sl"
                  style={{ background: "#e0a800" }}
                ></span>
                <span className="btn-v_text">Limpiar Selección</span>
              </span>
            </button>
          )}

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

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
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
                  // Props nuevos
                  isSelected={selectedImageIds.includes(image.id)}
                  onToggleSelect={handleToggleSelect}
                  isDraggingItem={activeDragId === image.id}
                />
              ))}
            </div>
          </SortableContext>
          {/* OVERLAY PARA PREVIEW DE MÚLTIPLES */}
          <DragOverlay>
            {activeDragId ? (
              <DraggableMultipleImages
                images={images}
                activeId={activeDragId}
                selectedImages={selectedImageIds}
              />
            ) : null}
          </DragOverlay>
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
