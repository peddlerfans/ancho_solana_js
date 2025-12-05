<template>
    <div class="address-management">
        <!-- 顶部工具栏 -->
        <el-card class="toolbar">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h2 style="margin: 0;">地址管理</h2>
                <el-button type="primary" @click="showAddDialog = true">
                    <el-icon>
                        <Plus />
                    </el-icon> 新增地址
                </el-button>
            </div>

            <!-- 筛选条件 -->
            <div style="margin-top: 20px; display: flex; gap: 10px; flex-wrap: wrap;">
                <el-select v-model="selectedUserId" placeholder="选择用户" clearable style="width: 200px;"
                    @change="fetchAddresses">
                    <el-option v-for="user in userOptions" :key="user.id" :label="`${user.username} (${user.email})`"
                        :value="user.id" />
                </el-select>

                <el-select v-model="filterDefault" placeholder="默认地址" clearable style="width: 120px;"
                    @change="fetchAddresses">
                    <el-option label="是" :value="1" />
                    <el-option label="否" :value="0" />
                </el-select>

                <el-input v-model="searchKeyword" placeholder="搜索联系人/电话" style="width: 250px;" clearable
                    @input="handleSearch">
                    <template #prefix>
                        <el-icon>
                            <Search />
                        </el-icon>
                    </template>
                </el-input>
            </div>
        </el-card>

        <!-- 地址表格 -->
        <el-card style="margin-top: 20px;">
            <el-table :data="addressList" v-loading="loading" style="width: 100%" stripe>
                <el-table-column prop="id" label="ID" width="80" />
                <el-table-column label="用户" width="150">
                    <template #default="{ row }">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <el-avatar :size="30" :src="row.user_avatar" />
                            <span>{{ row.username }}</span>
                        </div>
                    </template>
                </el-table-column>
                <el-table-column prop="contact_name" label="联系人" width="120" />
                <el-table-column prop="contact_phone" label="电话" width="130" />
                <el-table-column label="地址" min-width="250">
                    <template #default="{ row }">
                        <div class="address-info">
                            <div>{{ row.province }}{{ row.city }}{{ row.district }}</div>
                            <div style="color: #666; font-size: 12px;">{{ row.detail_address }}</div>
                        </div>
                    </template>
                </el-table-column>
                <el-table-column prop="is_default" label="默认" width="80">
                    <template #default="{ row }">
                        <el-tag v-if="row.is_default" type="success" size="small">是</el-tag>
                        <el-tag v-else type="info" size="small">否</el-tag>
                    </template>
                </el-table-column>
                <el-table-column prop="created_at" label="创建时间" width="180" />
                <el-table-column label="操作" width="200" fixed="right">
                    <template #default="{ row }">
                        <div style="display: flex; gap: 8px;">
                            <el-button size="small" type="warning" @click="toggleDefault(row)"
                                :disabled="row.is_default">
                                设为默认
                            </el-button>
                            <el-button size="small" type="danger" @click="deleteAddress(row)">
                                <el-icon>
                                    <Delete />
                                </el-icon>
                            </el-button>
                        </div>
                    </template>
                </el-table-column>
            </el-table>

            <!-- 分页 -->
            <div style="margin-top: 20px; display: flex; justify-content: center;">
                <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize"
                    :page-sizes="[10, 20, 50, 100]" :total="total" layout="total, sizes, prev, pager, next, jumper"
                    @size-change="fetchAddresses" @current-change="fetchAddresses" />
            </div>
        </el-card>

        <!-- 新增地址对话框 -->
        <el-dialog v-model="showAddDialog" title="新增地址" width="500px" @closed="resetAddressForm">
            <el-form ref="addressFormRef" :model="addressForm" :rules="addressRules" label-width="100px">
                <el-form-item label="所属用户" prop="user_id">
                    <el-select v-model="addressForm.user_id" placeholder="请选择用户" style="width: 100%;">
                        <el-option v-for="user in userOptions" :key="user.id"
                            :label="`${user.username} (${user.email})`" :value="user.id" />
                    </el-select>
                </el-form-item>

                <el-form-item label="联系人" prop="contact_name">
                    <el-input v-model="addressForm.contact_name" placeholder="请输入联系人姓名" />
                </el-form-item>

                <el-form-item label="联系电话" prop="contact_phone">
                    <el-input v-model="addressForm.contact_phone" placeholder="请输入联系电话" />
                </el-form-item>

                <el-form-item label="省份" prop="province">
                    <el-input v-model="addressForm.province" placeholder="请输入省份" />
                </el-form-item>

                <el-form-item label="城市" prop="city">
                    <el-input v-model="addressForm.city" placeholder="请输入城市" />
                </el-form-item>

                <el-form-item label="区县" prop="district">
                    <el-input v-model="addressForm.district" placeholder="请输入区县" />
                </el-form-item>

                <el-form-item label="详细地址" prop="detail_address">
                    <el-input v-model="addressForm.detail_address" type="textarea" :rows="3" placeholder="请输入详细地址" />
                </el-form-item>

                <el-form-item label="设为默认" prop="is_default">
                    <el-switch v-model="addressForm.is_default" />
                </el-form-item>
            </el-form>

            <template #footer>
                <span class="dialog-footer">
                    <el-button @click="showAddDialog = false">取消</el-button>
                    <el-button type="primary" @click="submitAddressForm">创建</el-button>
                </span>
            </template>
        </el-dialog>
    </div>
</template>

<script setup>
definePageMeta({
    ssr: false
})
import { ref, onMounted } from 'vue'
import { Plus, Search, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

// 状态管理
const addressList = ref([])
const userOptions = ref([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

// 筛选条件
const selectedUserId = ref('')
const filterDefault = ref('')
const searchKeyword = ref('')

// 对话框控制
const showAddDialog = ref(false)

// 表单数据
const addressForm = ref({
    user_id: '',
    contact_name: '',
    contact_phone: '',
    province: '',
    city: '',
    district: '',
    detail_address: '',
    is_default: false
})

// 表单验证规则
const addressRules = {
    user_id: [
        { required: true, message: '请选择用户', trigger: 'change' }
    ],
    contact_name: [
        { required: true, message: '请输入联系人姓名', trigger: 'blur' }
    ],
    contact_phone: [
        { required: true, message: '请输入联系电话', trigger: 'blur' }
    ],
    province: [
        { required: true, message: '请输入省份', trigger: 'blur' }
    ],
    city: [
        { required: true, message: '请输入城市', trigger: 'blur' }
    ],
    district: [
        { required: true, message: '请输入区县', trigger: 'blur' }
    ],
    detail_address: [
        { required: true, message: '请输入详细地址', trigger: 'blur' }
    ]
}

// 获取地址列表
const fetchAddresses = async () => {
    loading.value = true
    try {
        // 注意：你需要先创建一个 API 端点来获取地址列表
        // 或者这里可以使用组合查询
        const params = new URLSearchParams({
            page: currentPage.value,
            limit: pageSize.value,
            ...(selectedUserId.value && { user_id: selectedUserId.value }),
            ...(filterDefault.value !== '' && { is_default: filterDefault.value }),
            ...(searchKeyword.value && { search: searchKeyword.value })
        })

        // 这里假设你有一个 /api/addresses 接口
        const { data } = await useFetch(`/api/addresses?${params}`)

        if (data.value?.code === 200) {
            addressList.value = data.value.data.list
            total.value = data.value.data.pagination.total
        }
    } catch (error) {
        console.error('获取地址列表失败:', error)
        ElMessage.error('获取地址列表失败')
    } finally {
        loading.value = false
    }
}

// 获取用户列表（用于下拉选择）
const fetchUserOptions = async () => {
    try {
        const { data } = await useFetch('/api/users?limit=100')

        if (data.value?.code === 200) {
            userOptions.value = data.value.data.list
        }
    } catch (error) {
        console.error('获取用户列表失败:', error)
    }
}

// 搜索处理
const handleSearch = () => {
    currentPage.value = 1
    fetchAddresses()
}

// 设为默认地址
const toggleDefault = async (address) => {
    try {
        const { data } = await useFetch(`/api/addresses/${address.id}`, {
            method: 'PUT',
            body: { is_default: 1 }
        })

        if (data.value?.code === 200) {
            ElMessage.success('设置成功')
            fetchAddresses()
        }
    } catch (error) {
        ElMessage.error('设置失败')
    }
}

// 删除地址
const deleteAddress = async (address) => {
    try {
        await ElMessageBox.confirm(
            `确定要删除地址吗？`,
            '警告',
            {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning',
            }
        )

        const { data } = await useFetch(`/api/addresses/${address.id}`, {
            method: 'DELETE'
        })

        if (data.value?.code === 200) {
            ElMessage.success('删除成功')
            fetchAddresses()
        }
    } catch (error) {
        if (error !== 'cancel') {
            ElMessage.error('删除失败')
        }
    }
}

// 提交地址表单
const submitAddressForm = async () => {
    try {
        const { data } = await useFetch(`/api/users/${addressForm.value.user_id}/addresses`, {
            method: 'POST',
            body: addressForm.value
        })

        if (data.value?.code === 201) {
            ElMessage.success('创建成功')
            showAddDialog.value = false
            fetchAddresses()
        }
    } catch (error) {
        ElMessage.error('创建失败')
    }
}

// 重置地址表单
const resetAddressForm = () => {
    addressForm.value = {
        user_id: '',
        contact_name: '',
        contact_phone: '',
        province: '',
        city: '',
        district: '',
        detail_address: '',
        is_default: false
    }
}

// 初始化
onMounted(() => {
    fetchAddresses()
    fetchUserOptions()
})
</script>

<style scoped>
.address-management {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
}

.toolbar {
    margin-bottom: 20px;
}

.address-info {
    line-height: 1.5;
}
</style>