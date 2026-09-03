package com.industrial.machineocr.sync

import android.content.Context
import androidx.room.*
import androidx.work.*
import kotlinx.coroutines.flow.Flow
import java.util.concurrent.TimeUnit

/**
 * Room Entity: Stores Screen Capture Data for Offline Mills
 */
@Entity(tableName = "pending_confirmations")
data class MachineConfirmationEntity(
    @PrimaryKey val id: String,
    val createdAt: Long = System.currentTimeMillis(),
    val machineId: String,
    val templateId: String,
    val orderId: String,
    val operation: String,
    val plant: String,
    val workCenter: String,
    val yieldQty: Double,
    val yieldUnit: String,
    val runTimeHours: Double,
    val idleTimeHours: Double,
    val shift: String,
    val imageFilePath: String,
    val syncStatus: String = "PENDING", // PENDING, SYNCING, CONFIRMED, ERROR
    val sapConfNo: String? = null,
    val errorMessage: String? = null
)

/**
 * Room DAO for Local Persistence
 */
@Dao
interface ConfirmationDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertConfirmation(conf: MachineConfirmationEntity)

    @Query("SELECT * FROM pending_confirmations WHERE syncStatus = 'PENDING' ORDER BY createdAt ASC")
    suspend fun getPendingConfirmations(): List<MachineConfirmationEntity>

    @Query("UPDATE pending_confirmations SET syncStatus = :status, sapConfNo = :confNo WHERE id = :id")
    suspend fun markConfirmed(id: String, status: String, confNo: String)

    @Query("SELECT * FROM pending_confirmations ORDER BY createdAt DESC LIMIT 50")
    fun getAllConfirmations(): Flow<List<MachineConfirmationEntity>>
}

/**
 * Background WorkManager Worker:
 * Auto-triggers when Zebra device regains Wi-Fi / LTE connection to push queued confirmations to SAP
 */
class SapSyncWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        // 1. Check pending items in local SQLite
        // 2. Iterate and POST to SAP REST/OData endpoint
        // 3. Update sync status upon receiving HTTP 200 / 201
        return Result.success()
    }

    companion object {
        fun schedulePeriodicSync(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val syncRequest = PeriodicWorkRequestBuilder<SapSyncWorker>(15, TimeUnit.MINUTES)
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                "SapSyncWork",
                ExistingPeriodicWorkPolicy.KEEP,
                syncRequest
            )
        }
    }
}
