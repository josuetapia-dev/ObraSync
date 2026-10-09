import { Injectable } from '@angular/core';
import {
  CapacitorSQLite,
  SQLiteConnection,
  SQLiteDBConnection
} from '@capacitor-community/sqlite';

/**
 * Base de datos local (SQLite) de la app.
 * Todo se guarda primero aquí para que la app funcione sin internet (offline-first);
 * después el servicio Sync envía las ventas pendientes a la API de Laravel.
 */
@Injectable({
  providedIn: 'root',
})
export class Database {

  // Puente entre Angular y el plugin de SQLite.
  private sqlite: SQLiteConnection;
  // Conexión abierta a la base; se asigna en inicializarBD().
  private db!: SQLiteDBConnection;

  constructor() {
    this.sqlite = new SQLiteConnection(CapacitorSQLite);
  }

  // =========================================================
  // INICIALIZAR BASE DE DATOS
  // =========================================================

  /** Abre la base "ventasDB" y crea las tablas si no existen. Se llama al iniciar la app. */
  async inicializarBD() {

    try {

      // Si la conexión ya existe (p. ej. se llamó dos veces), se reutiliza en lugar de fallar.
      const existe =
        (await this.sqlite.isConnection('ventasDB', false)).result;

      this.db = existe
        ? await this.sqlite.retrieveConnection('ventasDB', false)
        : await this.sqlite.createConnection(
            'ventasDB',
            false,            // sin encriptación
            'no-encryption',
            1,                // versión del esquema
            false             // lectura y escritura
          );

      await this.db.open();

      const sql = `
        CREATE TABLE IF NOT EXISTS ventas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,  -- id local
          total REAL NOT NULL,
          fecha TEXT NOT NULL,
          sincronizado INTEGER DEFAULT 0,        -- 0 = pendiente, 1 = enviada a Laravel
          server_id INTEGER                      -- id que asigna Laravel al sincronizar
        );

        CREATE TABLE IF NOT EXISTS detalle_ventas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          venta_id INTEGER NOT NULL,
          producto_id INTEGER NOT NULL,
          cantidad INTEGER NOT NULL,
          precio REAL NOT NULL,
          subtotal REAL NOT NULL,
          FOREIGN KEY (venta_id)
          REFERENCES ventas(id)
        );

        CREATE TABLE IF NOT EXISTS productos (
          id INTEGER PRIMARY KEY,                -- mismo id que en Laravel
          nombre TEXT NOT NULL,
          descripcion TEXT,
          precio REAL NOT NULL
        );
      `;

      // execute() permite varias sentencias SQL en una sola llamada.
      await this.db.execute(sql);

      console.log('Base de datos inicializada correctamente');

    } catch (error) {

      console.error(
        'Error al inicializar la base de datos:',
        error
      );

    }

  }

  // =========================================================
  // CREATE - INSERTAR VENTA
  // =========================================================

  /** Guarda una venta local como pendiente (sincronizado = 0). Devuelve su id local. */
  async insertarVenta(
    total: number,
    fecha: string
  ): Promise<number | undefined> {

    try {

      // Los "?" se reemplazan por los valores del arreglo (evita inyección SQL).
      const sql = `
        INSERT INTO ventas
        (
          total,
          fecha,
          sincronizado
        )
        VALUES (?, ?, 0)
      `;

      const resultado = await this.db.run(
        sql,
        [
          total,
          fecha
        ]
      );

      // lastId = id autoincremental que SQLite asignó a la nueva venta.
      const id =
        resultado.changes?.lastId;

      console.log(
        'Venta registrada localmente:',
        id
      );

      return id;

    } catch (error) {

      console.error(
        'Error al insertar venta:',
        error
      );

      return undefined;

    }

  }

  // =========================================================
  // CREATE - INSERTAR DETALLE
  // =========================================================

  /** Guarda un producto de la venta. El subtotal se calcula aquí (cantidad × precio). */
  async insertarDetalle(
    ventaId: number,
    productoId: number,
    cantidad: number,
    precio: number
  ) {

    try {

      const subtotal =
        cantidad * precio;

      const sql = `
        INSERT INTO detalle_ventas
        (
          venta_id,
          producto_id,
          cantidad,
          precio,
          subtotal
        )
        VALUES (?, ?, ?, ?, ?)
      `;

      await this.db.run(
        sql,
        [
          ventaId,
          productoId,
          cantidad,
          precio,
          subtotal
        ]
      );

      console.log(
        'Detalle registrado correctamente'
      );

    } catch (error) {

      console.error(
        'Error al insertar detalle:',
        error
      );

    }

  }

  // ======================================================
  // READ - OBTENER TODAS LAS VENTAS
  // ======================================================

  /** Lista todas las ventas locales, de la más reciente a la más antigua. */
  async obtenerVentas() {

    try {

      const resultado =
        await this.db.query(`
          SELECT *
          FROM ventas
          ORDER BY id DESC
        `);

      // values trae las filas; si no hay, se devuelve un arreglo vacío.
      return resultado.values ?? [];

    } catch (error) {

      console.error(
        'Error al obtener ventas:',
        error
      );

      return [];

    }

  }

  // ======================================================
  // READ - OBTENER UNA VENTA
  // ======================================================

  /** Busca una venta por su id local. Devuelve null si no existe. */
  async obtenerVenta(id: number) {

    try {

      const resultado =
        await this.db.query(
          `
            SELECT *
            FROM ventas
            WHERE id = ?
          `,
          [id]
        );

      return resultado.values?.[0] ?? null;

    } catch (error) {

      console.error(
        'Error al obtener venta:',
        error
      );

      return null;

    }

  }

  // ======================================================
  // READ - OBTENER DETALLES DE UNA VENTA
  // ======================================================

  /** Lista los productos que pertenecen a una venta. */
  async obtenerDetalles(ventaId: number) {

    try {

      const resultado =
        await this.db.query(
          `
            SELECT *
            FROM detalle_ventas
            WHERE venta_id = ?
            ORDER BY id ASC
          `,
          [ventaId]
        );

      return resultado.values ?? [];

    } catch (error) {

      console.error(
        'Error al obtener detalles:',
        error
      );

      return [];

    }

  }

  // ======================================================
  // READ - VENTAS PENDIENTES DE SINCRONIZACIÓN
  // ======================================================

  /** Ventas que aún no se envían a Laravel (sincronizado = 0), en orden de creación. */
  async obtenerVentasPendientes() {

    try {

      const resultado =
        await this.db.query(`
          SELECT *
          FROM ventas
          WHERE sincronizado = 0
          ORDER BY id ASC
        `);

      return resultado.values ?? [];

    } catch (error) {

      console.error(
        'Error al obtener ventas pendientes:',
        error
      );

      return [];

    }

  }

  // ======================================================
  // UPDATE - ACTUALIZAR VENTA
  // ======================================================

  /** Edita una venta. Vuelve a quedar pendiente (sincronizado = 0) para reenviar el cambio. */
  async actualizarVenta(
    id: number,
    total: number,
    fecha: string
  ) {

    try {

      const sql = `
        UPDATE ventas
        SET
          total = ?,
          fecha = ?,
          sincronizado = 0
        WHERE id = ?
      `;

      await this.db.run(
        sql,
        [
          total,
          fecha,
          id
        ]
      );

      console.log(
        'Venta actualizada correctamente'
      );

    } catch (error) {

      console.error(
        'Error al actualizar venta:',
        error
      );

    }

  }

  // ======================================================
  // UPDATE - MARCAR VENTA COMO SINCRONIZADA
  // ======================================================

  /** Después de enviarla a Laravel: guarda el id del servidor y la marca como sincronizada. */
  async marcarSincronizada(
    id: number,
    serverId: number
  ) {

    try {

      const sql = `
        UPDATE ventas
        SET
          sincronizado = 1,
          server_id = ?
        WHERE id = ?
      `;

      await this.db.run(
        sql,
        [
          serverId,
          id
        ]
      );

      console.log(
        'Venta marcada como sincronizada'
      );

    } catch (error) {

      console.error(
        'Error al marcar venta como sincronizada:',
        error
      );

    }

  }

  // ======================================================
  // UPDATE - MARCAR VENTA COMO PENDIENTE
  // ======================================================

  /** Regresa una venta a pendiente (p. ej. si Laravel rechazó el envío y hay que reintentar). */
  async marcarPendiente(id: number) {

    try {

      await this.db.run(
        `
        UPDATE ventas
        SET sincronizado = 0
        WHERE id = ?
        `,
        [id]
      );

    } catch (error) {

      console.error(
        'Error al marcar venta como pendiente:',
        error
      );

    }

  }

  // ======================================================
  // DELETE - ELIMINAR DETALLES DE UNA VENTA
  // ======================================================

  /** Borra todos los productos de una venta. */
  async eliminarDetalles(ventaId: number) {

    try {

      await this.db.run(
        `
        DELETE FROM detalle_ventas
        WHERE venta_id = ?
        `,
        [ventaId]
      );

    } catch (error) {

      console.error(
        'Error al eliminar detalles:',
        error
      );

    }

  }

  // ======================================================
  // DELETE - ELIMINAR VENTA
  // ======================================================

  /** Borra una venta y sus detalles. */
  async eliminarVenta(id: number) {

    try {

      // Primero eliminamos los detalles (la llave foránea no permite dejarlos huérfanos)
      await this.eliminarDetalles(id);

      // Después la venta
      await this.db.run(
        `
        DELETE FROM ventas
        WHERE id = ?
        `,
        [id]
      );

      console.log(
        'Venta eliminada correctamente'
      );

    } catch (error) {

      console.error(
        'Error al eliminar venta:',
        error
      );

    }

  }

  // ======================================================
  // CONTAR VENTAS PENDIENTES
  // ======================================================

  /** Número de ventas sin sincronizar (útil para mostrar un indicador en pantalla). */
  async contarPendientes(): Promise<number> {

    try {

      const resultado =
        await this.db.query(`
          SELECT COUNT(*) AS total
          FROM ventas
          WHERE sincronizado = 0
        `);

      if (
        resultado.values &&
        resultado.values.length > 0
      ) {
        return resultado.values[0].total;
      }

      return 0;

    } catch (error) {

      console.error(
        'Error al contar pendientes:',
        error
      );

      return 0;

    }

  }

  // ======================================================
  // OBTENER VENTA COMPLETA
  // VENTA + DETALLES
  // ======================================================

  /** Junta la venta con sus productos; es el formato que se enviará a Laravel. */
  async obtenerVentaCompleta(
    ventaId: number
  ) {

    const venta =
      await this.obtenerVenta(ventaId);

    if (!venta) {
      return null;
    }

    const detalles =
      await this.obtenerDetalles(ventaId);

    return {
      ...venta,
      detalles
    };

  }

  // ======================================================
  // OBTENER VENTAS PENDIENTES CON SUS DETALLES
  // ======================================================

  /** Ventas sin sincronizar, cada una con su arreglo de detalles. Es lo que Sync envía a Laravel. */
  async obtenerPendientesCompletas() {

    const ventas =
      await this.obtenerVentasPendientes();

    const resultado: any[] = [];

    for (const venta of ventas) {

      const detalles =
        await this.obtenerDetalles(
          venta.id
        );

      resultado.push({

        ...venta,

        detalles: detalles

      });

    }

    return resultado;

  }

  // ======================================================
  // ELIMINAR TODA LA INFORMACIÓN LOCAL
  // ÚTIL PARA PRUEBAS
  // ======================================================

  /** Borra todas las ventas y detalles locales (primero los detalles, por la llave foránea). */
  async limpiarBaseDatos() {

    try {

      await this.db.execute(`
        DELETE FROM detalle_ventas;
        DELETE FROM ventas;
      `);

      console.log(
        'Base de datos local limpiada'
      );

    } catch (error) {

      console.error(
        'Error al limpiar base de datos:',
        error
      );

    }

  }

  // =========================================================
  // PRODUCTOS (CACHÉ LOCAL DEL CATÁLOGO DE LARAVEL)
  // =========================================================

  /** Reemplaza el catálogo local por el que llegó de Laravel (todo en una transacción). */
  async guardarProductos(
    productos: { id: number; nombre: string; descripcion: string | null; precio: number }[]
  ) {

    try {

      const sentencias = [
        { statement: 'DELETE FROM productos', values: [] as any[] },
        ...productos.map(p => ({
          statement: `
            INSERT INTO productos (id, nombre, descripcion, precio)
            VALUES (?, ?, ?, ?)
          `,
          values: [p.id, p.nombre, p.descripcion, p.precio]
        }))
      ];

      // executeSet ejecuta todas juntas: si una falla, no se borra el catálogo anterior.
      await this.db.executeSet(sentencias, true);

      console.log(
        'Productos guardados localmente:',
        productos.length
      );

    } catch (error) {

      console.error(
        'Error al guardar productos:',
        error
      );

    }

  }

  /** Catálogo guardado en el dispositivo (funciona sin internet). */
  async obtenerProductos() {

    try {

      const resultado =
        await this.db.query(`
          SELECT *
          FROM productos
          ORDER BY nombre ASC
        `);

      return resultado.values ?? [];

    } catch (error) {

      console.error(
        'Error al obtener productos:',
        error
      );

      return [];

    }

  }
}
