const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.STRING(64),
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  role: {
    type: DataTypes.STRING(50),
    defaultValue: 'USER',
    validate: {
      isIn: [[
        'SUPER_ADMIN',
        'ORG_ADMIN',
        'PROJECT_ADMIN',
        'PROJECT_USER',
        'LOCATION_USER',
        'SITE_USER',
        'ASSET_USER',
        'USER'
      ]]
    }
  },
  org_id: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  project_id: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  location_id: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  assigned_assets: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  assigned_devices: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: []
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password && !user.password.startsWith('$2a$') && !user.password.startsWith('$2b$')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password') && !user.password.startsWith('$2a$') && !user.password.startsWith('$2b$')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

User.prototype.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = User;
