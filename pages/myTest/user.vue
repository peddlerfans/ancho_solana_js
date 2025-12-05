<template>
    <div class="user-management">
        <!-- 顶部工具栏 -->
        <el-card class="toolbar">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h2 style="margin: 0;">用户管理</h2>
                <el-button type="primary" @click="showAddDialog = true">
                    <el-icon>
                        <Plus />
                    </el-icon> 新增用户
                </el-button>
            </div>

            <!-- 搜索栏 -->
            <div style="margin-top: 20px; display: flex; gap: 10px;">
                <el-input v-model="searchKeyword" placeholder="搜索用户名或邮箱" style="width: 300px;" clearable
                    @input="handleSearch">
                    <template #prefix>
                        <el-icon>
                            <Search />
                        </el-icon>
                    </template>
                </el-input>

                <el-button type="info" @click="resetSearch">
                    <el-icon>
                        <Refresh />
                    </el-icon> 重置
                </el-button>
            </div>
        </el-card>

        <!-- 用户表格 -->
        <el-card style="margin-top: 20px;">
            <el-table :data="userList" v-loading="loading" style="width: 100%" stripe>
                <el-table-column prop="id" label="ID" width="80" />
                <el-table-column prop="username" label="用户名" width="120" />
                <el-table-column prop="email" label="邮箱" />
                <el-table-column prop="phone" label="电话" width="120" />
                <el-table-column prop="address_count" label="地址数" width="100">
                    <template #default="scope">
                        <el-tag size="small" :type="scope.row.address_count > 0 ? 'success' : 'info'">
                            {{ scope.row.address_count }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column prop="is_active" label="状态" width="100">
                    <template #default="scope">
                        <el-tag :type="scope.row.is_active ? 'success' : 'danger'" size="small">
                            {{ scope.row.is_active ? '启用' : '禁用' }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column prop="created_at" label="创建时间" width="180" />
                <el-table-column label="操作" width="250" fixed="right">
                    <template #default="scope">
                        <div style="display: flex; gap: 8px;">
                            <el-button size="small" type="primary" @click="viewUser(scope.row.id)">
                                <el-icon>
                                    <View />
                                </el-icon> 查看
                            </el-button>
                            <el-button size="small" type="warning" @click="editUser(scope.row)">
                                <el-icon>
                                    <Edit />
                                </el-icon> 编辑
                            </el-button>
                            <el-button size="small" type="danger" @click="deleteUser(row)" :disabled="scope.row.id === 1">
                                <el-icon>
                                    <Delete />
                                </el-icon> 删除
                            </el-button>
                        </div>
                    </template>
                </el-table-column>
            </el-table>

            <!-- 分页 -->
            <div style="margin-top: 20px; display: flex; justify-content: center;">
                <el-pagination v-model:current-page="currentPage" v-model:page-size="pageSize"
                    :page-sizes="[10, 20, 50, 100]" :total="total" layout="total, sizes, prev, pager, next, jumper"
                    @size-change="fetchUsers" @current-change="fetchUsers" />
            </div>
        </el-card>

        <!-- 新增/编辑用户对话框 -->
        <el-dialog v-model="showEditDialog" :title="isEditMode ? '编辑用户' : '新增用户'" width="500px" @closed="resetForm">
            <el-form ref="userFormRef" :model="userForm" :rules="userRules" label-width="80px">
                <el-form-item label="用户名" prop="username">
                    <el-input v-model="userForm.username" placeholder="请输入用户名" />
                </el-form-item>

                <el-form-item label="邮箱" prop="email">
                    <el-input v-model="userForm.email" placeholder="请输入邮箱" />
                </el-form-item>

                <el-form-item :label="isEditMode ? '新密码' : '密码'" prop="password">
                    <el-input v-model="userForm.password" type="password"
                        :placeholder="isEditMode ? '留空则不修改密码' : '请输入密码'" show-password />
                </el-form-item>

                <el-form-item label="电话" prop="phone">
                    <el-input v-model="userForm.phone" placeholder="请输入电话" />
                </el-form-item>

                <el-form-item label="头像" prop="avatar_url">
                    <el-input v-model="userForm.avatar_url" placeholder="头像URL" />
                </el-form-item>

                <el-form-item label="状态" prop="is_active">
                    <el-switch v-model="userForm.is_active" :active-value="1" :inactive-value="0" />
                </el-form-item>
            </el-form>

            <template #footer>
                <span class="dialog-footer">
                    <el-button @click="showEditDialog = false">取消</el-button>
                    <el-button type="primary" @click="submitUserForm">
                        {{ isEditMode ? '更新' : '创建' }}
                    </el-button>
                </span>
            </template>
        </el-dialog>

        <!-- 用户详情对话框 -->
        <el-dialog v-model="showDetailDialog" title="用户详情" width="700px">
            <div v-if="currentUser" class="user-detail">
                <el-descriptions :column="2" border>
                    <el-descriptions-item label="ID">{{ currentUser.id }}</el-descriptions-item>
                    <el-descriptions-item label="用户名">{{ currentUser.username }}</el-descriptions-item>
                    <el-descriptions-item label="邮箱">{{ currentUser.email }}</el-descriptions-item>
                    <el-descriptions-item label="电话">{{ currentUser.phone }}</el-descriptions-item>
                    <el-descriptions-item label="状态">
                        <el-tag :type="currentUser.is_active ? 'success' : 'danger'">
                            {{ currentUser.is_active ? '启用' : '禁用' }}
                        </el-tag>
                    </el-descriptions-item>
                    <el-descriptions-item label="创建时间">{{ currentUser.created_at }}</el-descriptions-item>
                    <el-descriptions-item label="最后登录">{{ currentUser.last_login_at || '从未登录' }}</el-descriptions-item>
                </el-descriptions>

                <!-- 地址列表 -->
                <h3 style="margin-top: 20px;">地址列表</h3>
                <el-table :data="currentUser.addresses || []" size="small" style="margin-top: 10px;">
                    <el-table-column prop="contact_name" label="联系人" width="100" />
                    <el-table-column prop="contact_phone" label="电话" width="120" />
                    <el-table-column label="地址" min-width="200">
                        <template #default="{ row }">
                            {{ row.province }}{{ row.city }}{{ row.district }}{{ row.detail_address }}
                        </template>
                    </el-table-column>
                    <el-table-column prop="is_default" label="默认" width="80">
                        <template #default="{ row }">
                            <el-tag v-if="row.is_default" type="success" size="small">是</el-tag>
                            <el-tag v-else type="info" size="small">否</el-tag>
                        </template>
                    </el-table-column>
                </el-table>
            </div>
        </el-dialog>
    </div>
</template>

<script setup>
definePageMeta({
    ssr: false
})
import { ref, onMounted } from 'vue'
import {
    Plus, Search, Refresh, View, Edit, Delete,
    SuccessFilled, WarningFilled
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

// 状态管理
const userList = ref([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const searchKeyword = ref('')

// 对话框控制
const showEditDialog = ref(false)
const showDetailDialog = ref(false)
const isEditMode = ref(false)

// 表单数据
const currentUser = ref(null)
const userForm = ref({
    id: null,
    username: '',
    email: '',
    password: '',
    phone: '',
    avatar_url: '',
    is_active: 1
})

// 表单验证规则
const userRules = {
    username: [
        { required: true, message: '请输入用户名', trigger: 'blur' },
        { min: 3, max: 20, message: '长度在 3 到 20 个字符', trigger: 'blur' }
    ],
    email: [
        { required: true, message: '请输入邮箱', trigger: 'blur' },
        { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
    ],
    password: [
        { required: !isEditMode.value, message: '请输入密码', trigger: 'blur' },
        { min: 6, message: '密码至少6位', trigger: 'blur' }
    ]
}

// 获取用户列表
const fetchUsers = async () => {
    loading.value = true
    try {
        const params = new URLSearchParams({
            page: currentPage.value,
            limit: pageSize.value,
            ...(searchKeyword.value && { search: searchKeyword.value })
        })
        console.log(params);

        const data = await $fetch(`/api/tools/users?${params}`)
        console.log(data)
        if (data?.code === 200) {
            userList.value = data.data.list
            total.value = data.data.pagination.total
        }
    } catch (error) {
        ElMessage.error('获取用户列表失败')
    } finally {
        loading.value = false
    }
}

// 搜索处理
const handleSearch = () => {
    currentPage.value = 1
    fetchUsers()
}

const resetSearch = () => {
    searchKeyword.value = ''
    currentPage.value = 1
    fetchUsers()
}

// 查看用户详情
const viewUser = async (userId) => {
    try {
        const  data  = await $fetch(`/api/user/${userId}`)

        if (data?.code === 200) {
            currentUser.value = data.data
            showDetailDialog.value = true
        }
    } catch (error) {
        ElMessage.error('获取用户详情失败')
    }
}

// 编辑用户
const editUser = (user) => {
    isEditMode.value = true
    userForm.value = { ...user, password: '' }
    showEditDialog.value = true
}

// 删除用户
const deleteUser = async (user) => {
    try {
        await ElMessageBox.confirm(
            `确定要删除用户 "${user.username}" 吗？此操作不可恢复。`,
            '警告',
            {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning',
            }
        )

        const { data } = await $fetch(`/api/user/${user.id}`, {
            method: 'DELETE'
        })

        if (data.value?.code === 200) {
            ElMessage.success('删除成功')
            fetchUsers()
        }
    } catch (error) {
        if (error !== 'cancel') {
            ElMessage.error('删除失败')
        }
    }
}

// 提交用户表单
const submitUserForm = async () => {
    try {
        const method = isEditMode.value ? 'PUT' : 'POST'
        const url = isEditMode.value ? `/api/user/${userForm.value.id}` : '/api/tools/users'

        const  data  = await $fetch(url, {
            method,
            body: userForm.value
        })
        
        if (data?.code === 201 || data?.code === 200) {
            ElMessage.success(isEditMode.value ? '更新成功' : '创建成功')
            showEditDialog.value = false
            fetchUsers()
        }
    } catch (error) {
        ElMessage.error('操作失败')
    }
}

// 重置表单
const resetForm = () => {
    userForm.value = {
        id: null,
        username: '',
        email: '',
        password: '',
        phone: '',
        avatar_url: '',
        is_active: 1
    }
    isEditMode.value = false
}

// 初始化
onMounted(() => {
    fetchUsers()
})
</script>

<style scoped>
.user-management {
    padding: 20px;
    max-width: 1200px;
    margin: 0 auto;
}

.toolbar {
    margin-bottom: 20px;
}

.user-detail {
    max-height: 600px;
    overflow-y: auto;
}
</style>